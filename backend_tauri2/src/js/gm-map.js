// ---------- 地图视图 ----------

/** 地图图片在当前容器内的实际显示矩形（考虑 object-fit: contain 的黑边）。
 *  标记必须按这个矩形定位，而不是按整个容器——否则容器比例 ≠ 图片比例时（手机/窄屏）位置会错位。
 *  图片未加载完成（naturalWidth=0）时返回 null。 */
function mapImageRect() {
  const img = document.getElementById('mapImage');
  const container = document.getElementById('mapContainer');
  if (!img || !container) return null;
  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  if (!iw || !ih) return null;
  const cw = container.clientWidth;
  const ch = container.clientHeight;
  const scale = Math.min(cw / iw, ch / ih);
  const w = iw * scale;
  const h = ih * scale;
  return { left: (cw - w) / 2, top: (ch - h) / 2, width: w, height: h };
}

/** 归一化坐标 (x, y) -> 容器内像素位置（基于图片实际显示矩形；图片未加载时返回 null）。 */
function mapPoint(x, y) {
  const rect = mapImageRect();
  if (!rect) return null;
  return { left: rect.left + x * rect.width, top: rect.top + y * rect.height };
}

/** 把标记元素放到归一化坐标处：优先用图片实际矩形（px），图片未加载时退回容器百分比。 */
function applyMarkerPosition(marker, x, y) {
  const pt = mapPoint(x, y);
  if (pt) {
    marker.style.left = pt.left + 'px';
    marker.style.top = pt.top + 'px';
  } else {
    marker.style.left = (x * 100) + '%';
    marker.style.top = (y * 100) + '%';
  }
}

function renderMapTabs() {
  const tabs = document.getElementById('mapTabs');
  if (!tabs) return;
  tabs.innerHTML = '';
  if (!state) return;
  for (const map of knownMaps()) {
    const btn = document.createElement('button');
    btn.textContent = map;
    btn.className = map === effectiveMap() ? 'active' : '';
    btn.onclick = () => {
      selectedMap = map;
      renderMapTabs();
      renderMap();
    };
    tabs.appendChild(btn);
  }
}

let lastMapRenderKey = '';
let playerMarkers = {}; // playerId -> 持久化的玩家标记元素（不随渲染重建，避免动画重启/其他玩家跳动）

function renderMap() {
  if (!state) return;
  // 不自动跟随客户端切图：显示的哪个地图只由手动切换决定（首次默认客户端当前地图）
  if (!selectedMap) selectedMap = state.currentMap;

  const map = effectiveMap();

  // 变更守卫：地图/选中目标/对象/玩家位置都没变时跳过重建。
  // 否则每次 gm_update（位置上报、心跳）都清空重绘全部标记，
  // 会导致选中玩家的脉冲动画反复重启、其余玩家图标集体闪烁（看起来像都在播放动画）。
  const renderKey =
    map + '|' + (selectedObjectId || '') + '|' +
    JSON.stringify(state.objects) + '|' + JSON.stringify(state.players);
  if (renderKey === lastMapRenderKey) {
    return;
  }
  lastMapRenderKey = renderKey;

  const image = document.getElementById('mapImage');
  const mapSrc = backendUrl(`/maps/${map}.png`);
  if (image.src !== mapSrc) {
    image.onload = repositionMarkers; // 图片加载完成后按真实尺寸校正标记位置
    image.src = mapSrc;
  }

  const layer = document.getElementById('overlayLayer');
  layer.innerHTML = '';

  // 对象目标标记（显示名称，可点击选中；玩家单独用实时位置渲染）
  for (const [objectId, obj] of Object.entries(state.objects || {})) {
    if (obj.kind === 'Player') continue;
    if (obj.mapName !== map) continue;
    if (!obj.position) continue;

    const marker = document.createElement('button');
    marker.className = 'object-marker kind-' + (obj.kind || 'object') +
      (objectId === selectedObjectId ? ' selected' : '');
    const smParams = componentParams(obj, 'OptionValue') || {};
    const exParams = exchangeParams(obj);
    marker.title = `${obj.name || objectId}${shouldShowObjectId(objectId) ? ' (' + objectId + ')' : ''}\n${smParams.currentOption ? '当前：' + smParams.currentOption : '未配置选项'}`;
    marker.dataset.objectId = objectId;
    applyMarkerPosition(marker, num(obj.position.x, 0.5), num(obj.position.y, 0.5));

    const dot = document.createElement('span');
    dot.className = 'object-marker-dot';

    const label = document.createElement('span');
    label.className = 'object-marker-label';
    const remaining = itemRemaining(obj);
    label.textContent = remaining != null ? `${exParams.itemName} ×${remaining}` : (obj.name || objectId);

    marker.appendChild(dot);
    marker.appendChild(label);

    // 标记上同时显示当前状态（未配置状态时省略）
    if (smParams.currentOption) {
      const stateEl = document.createElement('span');
      stateEl.className = 'object-marker-state';
      stateEl.textContent = smParams.currentOption;
      marker.appendChild(stateEl);
    }

    marker.onclick = () => selectObject(objectId);
    layer.appendChild(marker);
  }

  // 玩家标记（实时位置；点击选中玩家对象）——持久化元素，只更新位置/名字/选中态，不重建
  renderPlayerMarkers();
}

/** 玩家标记持久化渲染：元素按 playerId 复用，仅更新位置、名字与选中态。
 *  不复建 DOM → 点击切换选中时，其他玩家的图标和文字完全不动（不再因重建+重新适配字号而跳动）。 */
function renderPlayerMarkers() {
  const map = effectiveMap();
  const playerLayer = document.getElementById('playerLayer');
  if (!playerLayer) return;

  const seen = {};
  for (const [playerId, player] of Object.entries(state.players || {})) {
    if (player.mapName !== map) continue;

    let marker = playerMarkers[playerId];
    if (!marker) {
      marker = document.createElement('button');
      marker.dataset.playerId = playerId;
      marker.onclick = () => selectObject(playerId);
      playerLayer.appendChild(marker);
      playerMarkers[playerId] = marker;
    }

    // 选中态：class 切换（元素复用 → width/height/font-size 过渡平滑，脉冲只出现在选中者上）
    marker.className = 'player-marker' + (playerId === selectedObjectId ? ' selected' : '');
    marker.title = player.name || playerId;

    const name = player.name || playerId;
    if (marker.textContent !== name) {
      marker.textContent = name;
      fitPlayerName(marker); // 仅名字真正变化时才重新适配字号
    }

    applyMarkerPosition(marker, num(player.position && player.position.x, 0.5), num(player.position && player.position.y, 0.5));
    seen[playerId] = true;
  }

  // 移除已不在当前地图/名单上的玩家标记
  for (const pid of Object.keys(playerMarkers)) {
    if (!seen[pid]) {
      playerMarkers[pid].remove();
      delete playerMarkers[pid];
    }
  }
}

/** 重定位所有已渲染的标记（不重建 DOM）：窗口尺寸变化 / 地图图片加载完成后调用。 */
function repositionMarkers() {
  if (!state) return;
  const map = effectiveMap();

  const layer = document.getElementById('overlayLayer');
  if (layer) {
    for (const marker of layer.querySelectorAll('.object-marker')) {
      const objectId = marker.dataset.objectId;
      const obj = objectId && state.objects && state.objects[objectId];
      if (!obj || obj.mapName !== map || !obj.position) continue;
      applyMarkerPosition(marker, obj.position.x, obj.position.y);
    }
  }

  const playerLayer = document.getElementById('playerLayer');
  if (playerLayer) {
    for (const marker of playerLayer.querySelectorAll('.player-marker')) {
      const playerId = marker.dataset.playerId;
      const player = playerId && state.players && state.players[playerId];
      if (!player || player.mapName !== map || !player.position) continue;
      applyMarkerPosition(marker, player.position.x, player.position.y);
    }
  }
}

/** 玩家名字自动缩放：保持一行不换行，字号从 13px 起逐级缩小直到放得进圆内。 */
function fitPlayerName(el) {
  var size = 13;
  el.style.fontSize = size + 'px';
  var maxWidth = el.clientWidth - 6; // 圆内可用宽度（减去左右 padding）
  var range = document.createRange();
  range.selectNodeContents(el);
  while (range.getBoundingClientRect().width > maxWidth && size > 8) {
    size -= 1;
    el.style.fontSize = size + 'px';
  }
}
