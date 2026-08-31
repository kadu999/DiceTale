// ---------- 遮罩编辑弹框 ----------

let maskEditorObjectId = null; // 正在编辑的遮罩对象 ID
let maskErasing = false;
let maskLastPoint = null;
let maskStroke = null; // 当前笔画轨迹（归一化坐标）+ 半径/软硬
let maskStrokeSent = 0; // 已发送的轨迹点数（增量发送用）
let maskStrokeTimer = null; // 拖动中节流发送定时器
let maskCanvasFor = null; // 当前画布内容对应的对象 ID（同对象重开保留擦除结果）
let maskStrokeSoftness = 1; // 笔刷软边带比例（0~1，0=硬边，1=全程衰减）：滑块/组件配置（edgeFeather）驱动，羽化带宽 = 笔刷半径 × 该值
let maskImageData = null; // 遮罩像素缓冲（GM 侧真源）：幂等擦除（min）用，初始全黑不透明
let maskMinPointDist = 12; // 记录轨迹点的最小像素间距（px）：由笔刷半径决定（≈半径×0.25，下限 4px）

/** 打开遮罩编辑弹框：为对象生成/保留黑色画布，可拖拽擦除。 */
function openMaskEditor(objectId) {
  const obj = state.objects && state.objects[objectId];
  const params = componentParams(obj, 'MaskImage') || {};
  if (!obj || !params.maskWidth || !params.maskHeight) {
    showToast('该对象没有遮罩尺寸信息');
    return;
  }

  maskEditorObjectId = objectId;

  // 软边厚度：组件配置（edgeFeather）优先；滑块可再临时调整（拖动中改滑块即时生效）
  const feather = Number(params.edgeFeather);
  maskStrokeSoftness = Number.isFinite(feather) ? Math.min(1, Math.max(0, feather)) : 1;
  syncMaskSoftnessUI();

  const modal = document.getElementById('maskEditorModal');
  const canvas = document.getElementById('maskCanvas');
  if (!modal || !canvas) return;

  // 同对象重开或尺寸变化时才重置画布（保留上次擦除结果，避免覆盖客户端已有擦除）
  if (maskCanvasFor !== objectId || canvas.width !== params.maskWidth || canvas.height !== params.maskHeight) {
    canvas.width = params.maskWidth;
    canvas.height = params.maskHeight;
    initMaskPixels(canvas, canvas.width, canvas.height); // 重建像素缓冲（全黑不透明）
    maskCanvasFor = objectId;
  }

  // 画布背面用当前地图图：擦除（透明）处直接透出地图，而不是棋盘格
  canvas.style.backgroundImage = `url('${backendUrl('/maps/' + encodeURIComponent(effectiveMap()) + '.png')}')`;
  canvas.style.backgroundSize = '100% 100%';
  canvas.style.backgroundRepeat = 'no-repeat';

  document.getElementById('maskEditorTitle').textContent = '编辑遮罩：' + (obj.name || objectId);
  if (window.bootstrap) {
    bootstrap.Modal.getOrCreateInstance(modal).show();
  } else {
    modal.style.display = 'flex';
  }
}

function closeMaskEditor() {
  const modal = document.getElementById('maskEditorModal');
  if (modal) {
    if (window.bootstrap) {
      bootstrap.Modal.getOrCreateInstance(modal).hide();
    } else {
      modal.style.display = 'none';
    }
  }
  maskEditorObjectId = null;
  maskErasing = false;
  maskLastPoint = null;
  maskStroke = null;
  maskStrokeSent = 0;
  if (maskStrokeTimer) {
    clearTimeout(maskStrokeTimer);
    maskStrokeTimer = null;
  }
}

/** 重建遮罩像素缓冲（全黑不透明）：GM 侧幂等擦除的真源，初始状态与客户端一致。 */
function initMaskPixels(canvas, width, height) {
  const ctx = canvas.getContext('2d');
  maskImageData = ctx.createImageData(width, height);
  const d = maskImageData.data;
  for (let i = 3; i < d.length; i += 4) d[i] = 255; // 不透明黑（rgb 默认 0）
  ctx.putImageData(maskImageData, 0, 0);
}

/** 把当前软边厚度同步到滑块 UI（打开弹框/组件配置变化时调用）。 */
function syncMaskSoftnessUI() {
  const slider = document.getElementById('maskSoftnessSlider');
  const value = document.getElementById('maskSoftnessValue');
  if (slider) slider.value = Math.round(maskStrokeSoftness * 100);
  if (value) value.textContent = Math.round(maskStrokeSoftness * 100) + '%';
}

/** canvas 客户端坐标 -> 画布像素坐标（考虑 CSS 缩放）。 */
function maskCanvasPoint(e) {
  const canvas = document.getElementById('maskCanvas');
  const rect = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) * (canvas.width / rect.width),
    y: (e.clientY - rect.top) * (canvas.height / rect.height),
  };
}

/** 在遮罩像素缓冲上擦掉一个软笔刷圆（与客户端 MaskEraseStamp 同一公式，幂等 min）：
 *  全擦核半径 core = radius×(1-softness)：核内全擦，core ~ radius 线性渐隐——离中心越远擦除越小；
 *  softness=0 → 硬边（核=radius）；softness=1 → 无核全程线性衰减。
 *  同一位置擦 N 次 = 擦 1 次（alpha 取 min），渐变带不会被反复擦除叠加成硬边。
 *  只更新圆包围盒内像素（局部 putImageData），保证拖动实时。 */
function maskEraseDot(ctx, x, y, radius, softness) {
  if (!maskImageData) return;
  const W = maskImageData.width;
  const H = maskImageData.height;
  const data = maskImageData.data;
  const core = radius * (1 - Math.min(1, Math.max(0, softness)));
  const denom = Math.max(radius - core, 1e-5);
  const r2 = radius * radius;
  const x0 = Math.max(0, Math.floor(x - radius));
  const x1 = Math.min(W - 1, Math.ceil(x + radius));
  const y0 = Math.max(0, Math.floor(y - radius));
  const y1 = Math.min(H - 1, Math.ceil(y + radius));
  for (let py = y0; py <= y1; py++) {
    const dy = py - y;
    for (let px = x0; px <= x1; px++) {
      const dx = px - x;
      const d2 = dx * dx + dy * dy;
      if (d2 >= r2) continue;
      const s = 1 - Math.min(1, Math.max(0, (Math.sqrt(d2) - core) / denom));
      const alpha = Math.round(255 * (1 - s));
      const idx = (py * W + px) * 4 + 3;
      if (alpha < data[idx]) data[idx] = alpha;
    }
  }
  ctx.putImageData(maskImageData, 0, 0, x0, y0, x1 - x0 + 1, y1 - y0 + 1);
}

/** 沿线段多次画软笔刷圆，避免拖拽过快出现断点。 */
function maskEraseSegment(ctx, from, to, radius, softness) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const steps = Math.max(1, Math.ceil(dist / Math.max(1, radius * 0.5)));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    maskEraseDot(ctx, from.x + dx * t, from.y + dy * t, radius, softness);
  }
}

/** 追加一个轨迹点（画布像素坐标，内部转归一化；去抖：与上一点像素距离小于阈值时跳过，降低轨迹点密度）。
 *  阈值 ≈ 笔刷半径×0.25（下限 4px），远小于客户端打点步长（半径×0.5），线段仍无缝连续。
 *  返回是否记录了新点：调用方据此决定是否安排发送（位置不再改变时不再发送）。 */
function pushStrokePoint(px, py) {
  if (!maskStroke) return false;
  const canvas = document.getElementById('maskCanvas');
  const last = maskStroke.points[maskStroke.points.length - 1];
  if (last) {
    const dx = px - last.x * canvas.width;
    const dy = py - last.y * canvas.height;
    if (Math.hypot(dx, dy) < maskMinPointDist) return false;
  }
  maskStroke.points.push({ x: px / canvas.width, y: py / canvas.height });
  return true;
}

/** 发送一段轨迹（增量）：包含上一段最后一个点，客户端可连线（幂等擦除，重复点无害）；done=true 表示笔画结束。
 *  按下时起点已在 pointerdown 单独发送；拖动中节流发增量；松手只在“有新点未发”时发 done 段兜底尾部，
 *  单击/未移动不重复发送。 */
function sendMaskStrokeSegment(done) {
  if (!maskEditorObjectId || !maskStroke) {
    maskStroke = null;
    return;
  }

  const all = maskStroke.points;

  // 起点已在 pointerdown 发出且没有新点（单击/按住未移动）：不再重复发送
  if (done && all.length <= maskStrokeSent) {
    maskStroke = null;
    return;
  }

  const start = Math.max(0, maskStrokeSent - 1);
  if (all.length - start < (done ? 1 : 2)) {
    if (done) maskStroke = null;
    return;
  }

  const seg = all.slice(start);
  maskStrokeSent = all.length;
  send({
    type: 'gm_erase_mask',
    objectId: maskEditorObjectId,
    stroke: {
      points: seg,
      radius: maskStroke.radius,
      softness: maskStroke.softness,
      done: done,
    },
  });

  if (done) maskStroke = null;
}

/** 拖动中节流（120ms）：把新轨迹点发一段给客户端，让前端拖动时实时刷新。 */
function scheduleMaskStrokeSend() {
  if (!maskStroke || maskStrokeTimer) return;
  maskStrokeTimer = setTimeout(() => {
    maskStrokeTimer = null;
    sendMaskStrokeSegment(false);
  }, 120);
}

// 画布擦除事件（只绑定一次）
(function initMaskCanvas() {
  const canvas = document.getElementById('maskCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const brushRadius = 48; // 笔刷半径（画布像素）：软边厚度由 maskStrokeSoftness（滑块/组件配置）控制，客户端 shader 按同公式计算
  maskMinPointDist = Math.max(4, brushRadius * 0.25); // 记录轨迹点最小间距（px）：半径×0.25，远小于客户端打点步长（半径×0.5）

  canvas.addEventListener('pointerdown', (e) => {
    if (!maskEditorObjectId) return;
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    maskErasing = true;

    // 新建笔画：半径归一化（相对画布宽度，客户端按自身纹理宽度换算，保证一致）
    maskStroke = {
      points: [],
      radius: brushRadius / canvas.width,
      softness: maskStrokeSoftness,
    };

    const p = maskCanvasPoint(e);
    maskLastPoint = p;
    pushStrokePoint(p.x, p.y);
    maskEraseDot(ctx, p.x, p.y, brushRadius, maskStrokeSoftness);

    // 按下只发送一次：立即把起点同步给客户端（拖动中再发增量；不移动时不再重复发送）
    send({
      type: 'gm_erase_mask',
      objectId: maskEditorObjectId,
      stroke: {
        points: [maskStroke.points[0]],
        radius: maskStroke.radius,
        softness: maskStroke.softness,
        done: false,
      },
    });
    maskStrokeSent = 1;
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!maskErasing || !maskEditorObjectId) return;
    const soft = maskStrokeSoftness; // 拖动中调滑块即时生效：预览与发送都跟随最新软边厚度
    maskStroke.softness = soft;
    const p = maskCanvasPoint(e);
    if (maskLastPoint) {
      maskEraseSegment(ctx, maskLastPoint, p, brushRadius, soft);
    } else {
      maskEraseDot(ctx, p.x, p.y, brushRadius, soft);
    }
    maskLastPoint = p;
    // 只有记录到新位置（位移超过阈值）才安排增量发送——位置不再改变时不再发送
    if (pushStrokePoint(p.x, p.y)) {
      scheduleMaskStrokeSend(); // 拖动中节流增量发送，前端实时刷新
    }
  });

  const endErase = () => {
    maskErasing = false;
    maskLastPoint = null;
    if (maskStrokeTimer) {
      clearTimeout(maskStrokeTimer);
      maskStrokeTimer = null;
    }
    sendMaskStrokeSegment(true); // 松手发送最后一段并结束笔画
  };
  canvas.addEventListener('pointerup', endErase);
  canvas.addEventListener('pointercancel', endErase);

  // 边缘厚度滑块：0~100% ↔ 软边比例 0~1（拖动中调滑块立即生效）
  const softnessSlider = document.getElementById('maskSoftnessSlider');
  if (softnessSlider) {
    softnessSlider.addEventListener('input', () => {
      maskStrokeSoftness = Number(softnessSlider.value) / 100;
      syncMaskSoftnessUI();
    });
  }
})();
