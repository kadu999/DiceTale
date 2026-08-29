// ---------- 地图视图 ----------

function renderMapTabs() {
  const tabs = document.getElementById('mapTabs');
  tabs.innerHTML = '';
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
  if (image.src !== `/maps/${map}.png`) {
    image.src = `/maps/${map}.png`;
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
    const smParams = componentParams(obj, 'StateMachine') || {};
    const exParams = exchangeParams(obj);
    marker.title = `${obj.name || objectId} (${objectId})\n${smParams.currentState ? '当前：' + smParams.currentState : '未配置状态'}`;
    marker.style.left = `${num(obj.position.x, 0.5) * 100}%`;
    marker.style.top = `${num(obj.position.y, 0.5) * 100}%`;

    const dot = document.createElement('span');
    dot.className = 'object-marker-dot';

    const label = document.createElement('span');
    label.className = 'object-marker-label';
    const remaining = itemRemaining(obj);
    label.textContent = remaining != null ? `${exParams.itemName} ×${remaining}` : (obj.name || objectId);

    marker.appendChild(dot);
    marker.appendChild(label);

    // 标记上同时显示当前状态（未配置状态时省略）
    if (smParams.currentState) {
      const stateEl = document.createElement('span');
      stateEl.className = 'object-marker-state';
      stateEl.textContent = smParams.currentState;
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

    marker.style.left = `${num(player.position && player.position.x, 0.5) * 100}%`;
    marker.style.top = `${num(player.position && player.position.y, 0.5) * 100}%`;
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
