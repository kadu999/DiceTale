const wsUrl = `ws://${location.host}/gm`;
let ws;
let state = null;
let selectedMap = null;
let lastManualMapPick = 0;
let apiMaps = []; // GET /api/maps 返回的所有可观看地图 [{name, image}]
let selectedObjectId = null; // 当前选中的目标（对象 ID）

// 加载时获取服务器可提供的地图列表（浏览所有地图）
fetch('/api/maps')
  .then((res) => res.json())
  .then((data) => {
    apiMaps = data.maps || [];
    if (state) render();
  })
  .catch(() => {});

function connect() {
  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    setStatus(true);
  };

  ws.onclose = () => {
    setStatus(false);
    setTimeout(connect, 2000);
  };

  ws.onerror = () => {};

  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.type === 'gm_update' || msg.type === 'sync_state') {
      state = msg.state;
      render();
    }
  };
}

function setStatus(connected) {
  const el = document.getElementById('connectionStatus');
  el.className = `status ${connected ? 'connected' : 'disconnected'}`;
  el.textContent = connected ? '已连接' : '未连接';
}

function send(msg) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

// ---------- 渲染 ----------

function render() {
  if (!state) return;
  renderMapTabs();
  renderMap();
  renderObjectList();
  renderPropertyPanel();
}

function knownMaps() {
  const maps = new Set(apiMaps.map((m) => m.name));
  for (const map of Object.keys(state.spawnPoints || {})) {
    maps.add(map);
  }
  if (state.currentMap) maps.add(state.currentMap);
  return maps;
}

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
      lastManualMapPick = Date.now();
      renderMapTabs();
      renderMap();
    };
    tabs.appendChild(btn);
  }
}

function effectiveMap() {
  if (selectedMap && knownMaps().has(selectedMap)) return selectedMap;
  return state.currentMap || (apiMaps.length > 0 ? apiMaps[0].name : null) || 'Map001';
}

/** 兼容旧 WebView：取 v 的数值，空值回退 fallback（替代 ?? 语法） */
function num(v, fallback) {
  return v === undefined || v === null ? fallback : v;
}

// ---- 物体图标（内联 SVG，白色，兼容旧 WebView）----
const ICON_PLAYER =
  '<svg viewBox="0 0 24 24" width="16" height="16" fill="#fff">' +
  '<circle cx="12" cy="7.5" r="3.5"/>' +
  '<path d="M4.5 21c0-4.1 3.4-7 7.5-7s7.5 2.9 7.5 7"/>' +
  '</svg>';

/** 选中目标：地图标记与对象列表同步高亮，右侧属性面板显示属性。 */
function selectObject(objectId) {
  selectedObjectId = objectId;
  renderMap();
  renderObjectList();
  renderPropertyPanel();
}

function renderMap() {
  // 跟随玩家当前地图：除非用户在 5 秒内手动选择了其他地图
  if (selectedMap && Date.now() - lastManualMapPick > 5000 && state.currentMap !== selectedMap) {
    selectedMap = state.currentMap;
  }
  if (!selectedMap) selectedMap = state.currentMap;

  const map = effectiveMap();
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
    marker.title = `${obj.name || objectId} (${objectId})\n${obj.currentState ? '当前：' + obj.currentState : '未配置状态'}`;
    marker.style.left = `${num(obj.position.x, 0.5) * 100}%`;
    marker.style.top = `${num(obj.position.y, 0.5) * 100}%`;

    const dot = document.createElement('span');
    dot.className = 'object-marker-dot';

    const label = document.createElement('span');
    label.className = 'object-marker-label';
    label.textContent = obj.name || objectId;

    marker.appendChild(dot);
    marker.appendChild(label);
    marker.onclick = () => selectObject(objectId);
    layer.appendChild(marker);
  }

  // 玩家标记（实时位置；点击选中玩家对象）
  for (const [playerId, player] of Object.entries(state.players || {})) {
    if (player.mapName !== map) continue;

    const marker = document.createElement('button');
    marker.className = 'player-marker' + (playerId === selectedObjectId ? ' selected' : '');
    marker.title = player.name || playerId;
    marker.style.left = `${num(player.position && player.position.x, 0.5) * 100}%`;
    marker.style.top = `${num(player.position && player.position.y, 0.5) * 100}%`;

    const icon = document.createElement('span');
    icon.innerHTML = ICON_PLAYER;

    const nameEl = document.createElement('span');
    nameEl.className = 'player-marker-name';
    nameEl.textContent = player.name || playerId;

    marker.appendChild(icon);
    marker.appendChild(nameEl);
    marker.onclick = () => {
      if (state.objects && state.objects[playerId]) selectObject(playerId);
    };
    layer.appendChild(marker);
  }
}

function fmtPos(pos) {
  if (!pos) return '-';
  return `(${pos.x.toFixed(2)}, ${pos.y.toFixed(2)})`;
}

// ---------- 属性列表（右侧） ----------

/** 渲染选中目标的属性：基础信息 + 可修改的状态切换按钮。 */
function renderPropertyPanel() {
  const container = document.getElementById('propertyList');
  container.innerHTML = '';

  if (!selectedObjectId) {
    container.innerHTML = '<div class="property-empty">请在地图上点击目标，查看并修改其属性</div>';
    return;
  }

  const obj = state.objects && state.objects[selectedObjectId];
  if (!obj) {
    container.innerHTML = '<div class="property-empty">未找到该对象（可能已移除）</div>';
    return;
  }

  addPropertyRow(container, '名称', obj.name || selectedObjectId);
  addPropertyRow(container, 'ID', selectedObjectId);
  addPropertyRow(container, '类型', obj.kind || 'object');
  addPropertyRow(container, '地图', obj.mapName || '-');
  addPropertyRow(container, '位置', fmtPos(obj.position));
  addPropertyRow(container, '当前状态', obj.currentState || '未配置');

  // 状态切换（点击即发送 gm_set_object_state）
  const statesRow = document.createElement('div');
  statesRow.className = 'property-row';
  const label = document.createElement('span');
  label.className = 'property-label';
  label.textContent = '切换状态';
  const statesBox = document.createElement('div');
  statesBox.className = 'property-states';

  const states = obj.states || [];
  if (states.length === 0) {
    const hint = document.createElement('div');
    hint.className = 'property-hint';
    hint.textContent = '该对象未配置状态列表（在客户端 Inspector 的 BackendObject 状态列表里配置）';
    statesBox.appendChild(hint);
  } else {
    for (const stateName of states) {
      const btn = document.createElement('button');
      btn.className = 'state-btn' + (stateName === obj.currentState ? ' active' : '');
      btn.textContent = stateName;
      btn.onclick = () => {
        send({ type: 'gm_set_object_state', objectId: selectedObjectId, state: stateName });
      };
      statesBox.appendChild(btn);
    }
  }

  statesRow.appendChild(label);
  statesRow.appendChild(statesBox);
  container.appendChild(statesRow);
}

function addPropertyRow(container, labelText, value) {
  const row = document.createElement('div');
  row.className = 'property-row';
  const label = document.createElement('span');
  label.className = 'property-label';
  label.textContent = labelText;
  const valueEl = document.createElement('span');
  valueEl.className = 'property-value';
  valueEl.textContent = value;
  row.appendChild(label);
  row.appendChild(valueEl);
  container.appendChild(row);
}

// ---------- 后台对象列表 ----------

/** 渲染所有 BackendObject：点击行选中目标（属性显示在右侧面板）。 */
function renderObjectList() {
  const container = document.getElementById('objectList');
  container.innerHTML = '';

  const objects = Object.entries(state.objects || {});
  if (objects.length === 0) {
    container.innerHTML = '<div class="object-row empty">暂无对象</div>';
    return;
  }

  for (const [objectId, obj] of objects) {
    const row = document.createElement('div');
    row.className = 'object-row' + (objectId === selectedObjectId ? ' selected' : '');

    const kindEl = document.createElement('span');
    kindEl.className = 'object-kind';
    kindEl.textContent = obj.kind || 'object';

    const nameEl = document.createElement('span');
    nameEl.className = 'object-name';
    nameEl.textContent = obj.name || objectId;

    const idEl = document.createElement('span');
    idEl.className = 'object-id';
    idEl.textContent = objectId;

    const stateEl = document.createElement('span');
    stateEl.className = 'object-current';
    stateEl.textContent = obj.currentState ? '当前：' + obj.currentState : '未配置状态';

    row.appendChild(kindEl);
    row.appendChild(nameEl);
    row.appendChild(idEl);
    row.appendChild(stateEl);
    row.onclick = () => selectObject(objectId);
    container.appendChild(row);
  }
}

// ---- 横屏时地图按 16:9 等比（高度决定宽度），避免 contain 两侧黑边 ----
function fitMapContainer() {
  var container = document.getElementById('mapContainer');
  if (!container) return;

  var isLandscape = window.matchMedia('(orientation: landscape)').matches;
  if (isLandscape) {
    var h = container.clientHeight;
    var maxW = container.parentElement.clientWidth;
    container.style.width = Math.min(Math.round(h * 16 / 9), maxW) + 'px';
  } else {
    container.style.width = '';
  }
}

window.addEventListener('resize', fitMapContainer);
window.addEventListener('orientationchange', function () {
  setTimeout(fitMapContainer, 300);
});
setTimeout(fitMapContainer, 300);

connect();
