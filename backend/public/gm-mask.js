// ---------- 遮罩编辑弹框 ----------

let maskEditorObjectId = null; // 正在编辑的遮罩对象 ID
let maskErasing = false;
let maskLastPoint = null;
let maskStroke = null; // 当前笔画轨迹（归一化坐标）+ 半径/软硬
let maskStrokeSent = 0; // 已发送的轨迹点数（增量发送用）
let maskStrokeTimer = null; // 拖动中节流发送定时器
let maskCanvasFor = null; // 当前画布内容对应的对象 ID（同对象重开保留擦除结果）

/** 打开遮罩编辑弹框：为对象生成/保留黑色画布，可拖拽擦除。 */
function openMaskEditor(objectId) {
  const obj = state.objects && state.objects[objectId];
  const params = componentParams(obj, 'MaskImage') || {};
  if (!obj || !params.maskWidth || !params.maskHeight) {
    showToast('该对象没有遮罩尺寸信息');
    return;
  }

  maskEditorObjectId = objectId;

  const modal = document.getElementById('maskEditorModal');
  const canvas = document.getElementById('maskCanvas');
  if (!modal || !canvas) return;

  // 同对象重开或尺寸变化时才重置画布（保留上次擦除结果，避免覆盖客户端已有擦除）
  if (maskCanvasFor !== objectId || canvas.width !== params.maskWidth || canvas.height !== params.maskHeight) {
    canvas.width = params.maskWidth;
    canvas.height = params.maskHeight;
    const ctx = canvas.getContext('2d');
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    maskCanvasFor = objectId;
  }

  // 画布背面用当前地图图：擦除（透明）处直接透出地图，而不是棋盘格
  canvas.style.backgroundImage = `url('/maps/${encodeURIComponent(effectiveMap())}.png')`;
  canvas.style.backgroundSize = '100% 100%';
  canvas.style.backgroundRepeat = 'no-repeat';

  document.getElementById('maskEditorTitle').textContent = '编辑遮罩：' + (obj.name || objectId);
  modal.style.display = 'flex';
}

function closeMaskEditor() {
  const modal = document.getElementById('maskEditorModal');
  if (modal) modal.style.display = 'none';
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

/** canvas 客户端坐标 -> 画布像素坐标（考虑 CSS 缩放）。 */
function maskCanvasPoint(e) {
  const canvas = document.getElementById('maskCanvas');
  const rect = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) * (canvas.width / rect.width),
    y: (e.clientY - rect.top) * (canvas.height / rect.height),
  };
}

/** 在画布上擦掉一个软笔刷圆（destination-out，与客户端 MaskEraseStamp 同一公式）：
 *  核内（d < radius）全擦，外圈 radius ~ radius*(1+softness) 平滑渐隐——预览即最终软边，与客户端一致。 */
function maskEraseDot(ctx, x, y, radius, softness) {
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';

  const outer = radius * (1 + Math.max(0, softness));
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, outer);
  gradient.addColorStop(0, 'rgba(0, 0, 0, 1)');
  gradient.addColorStop(radius / outer, 'rgba(0, 0, 0, 1)'); // 核内全擦
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');             // 外圈渐隐
  ctx.fillStyle = gradient;

  ctx.beginPath();
  ctx.arc(x, y, outer, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
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

/** 追加一个轨迹点（归一化坐标，去抖：与上一点距离过小时跳过）。 */
function pushStrokePoint(p) {
  if (!maskStroke) return;
  const last = maskStroke.points[maskStroke.points.length - 1];
  if (last && Math.hypot(p.x - last.x, p.y - last.y) < 0.002) return;
  maskStroke.points.push({ x: p.x, y: p.y });
}

/** 发送一段轨迹（增量）：包含上一段最后一个点，客户端可连线；done=true 表示笔画结束。
 *  done 段放宽到单点：单击/笔画尾部也必须同步到客户端，否则网页擦了客户端不动（尾部被掐）。 */
function sendMaskStrokeSegment(done) {
  if (!maskEditorObjectId || !maskStroke) {
    maskStroke = null;
    return;
  }

  const all = maskStroke.points;
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
  const brushRadius = 48; // 笔刷半径（画布像素，硬边）：软边由客户端 shader 按同半径计算
  const strokeSoftness = 0.5; // 软边羽化比例（0~1）：客户端 stamp 在 radius ~ radius*(1+softness) 之间过渡

  canvas.addEventListener('pointerdown', (e) => {
    if (!maskEditorObjectId) return;
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    maskErasing = true;

    // 新建笔画：半径归一化（相对画布宽度，客户端按自身纹理宽度换算，保证一致）
    maskStroke = {
      points: [],
      radius: brushRadius / canvas.width,
      softness: strokeSoftness,
    };

    const p = maskCanvasPoint(e);
    maskLastPoint = p;
    pushStrokePoint({ x: p.x / canvas.width, y: p.y / canvas.height });
    maskEraseDot(ctx, p.x, p.y, brushRadius, strokeSoftness);
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!maskErasing || !maskEditorObjectId) return;
    const p = maskCanvasPoint(e);
    if (maskLastPoint) {
      maskEraseSegment(ctx, maskLastPoint, p, brushRadius, strokeSoftness);
    } else {
      maskEraseDot(ctx, p.x, p.y, brushRadius, strokeSoftness);
    }
    maskLastPoint = p;
    pushStrokePoint({ x: p.x / canvas.width, y: p.y / canvas.height });
    scheduleMaskStrokeSend(); // 拖动中节流增量发送，前端实时刷新
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
})();
