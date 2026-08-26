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

let activePage = 'map'; // 'map' | 'players'

/** 切换大页面（地图 / 玩家）。 */
function switchPage(page) {
  activePage = page === 'players' ? 'players' : 'map';
  document.getElementById('pageMap').classList.toggle('active', activePage === 'map');
  document.getElementById('pagePlayers').classList.toggle('active', activePage === 'players');
  document.getElementById('pageBtnMap').classList.toggle('active', activePage === 'map');
  document.getElementById('pageBtnPlayers').classList.toggle('active', activePage === 'players');
  renderPropertyPanel();
  if (activePage === 'players') {
    renderPlayerList();
  } else {
    setTimeout(fitMapContainer, 50); // 地图页重新显示后重算地图尺寸
  }
}

function render() {
  if (!state) return;
  renderMapTabs();
  renderMap();
  renderPlayerList();
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

/** 选中目标：地图标记与玩家列表同步高亮，属性面板显示属性。 */
function selectObject(objectId) {
  selectedObjectId = objectId;
  renderMap();
  renderPlayerList();
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

    // 标记上同时显示当前状态（未配置状态时省略）
    if (obj.currentState) {
      const stateEl = document.createElement('span');
      stateEl.className = 'object-marker-state';
      stateEl.textContent = obj.currentState;
      marker.appendChild(stateEl);
    }

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

/** 渲染选中目标的属性：基础信息 + 物品 + 可修改的状态切换按钮（属于地图页）。 */
function renderPropertyPanel() {
  renderPropertyPanelInto('propertyListMap');
}

function renderPropertyPanelInto(id) {
  const container = document.getElementById(id);
  if (!container) return;
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
  addPropertyRow(container, '位置', fmtPos(obj.position));

  // 物品列表（BackendObject 通用能力，与后台同步：可添加 / 移除）
  renderObjectItems(container, selectedObjectId, obj.items || []);

  // 状态切换（点击即发送 gm_set_object_state）
  renderObjectStates(container, selectedObjectId, obj);
}

/** 渲染状态切换区（属性面板与玩家卡片共用）。 */
function renderObjectStates(container, objectId, obj) {
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
        send({ type: 'gm_set_object_state', objectId, state: stateName });
      };
      statesBox.appendChild(btn);
    }
  }

  statesRow.appendChild(label);
  statesRow.appendChild(statesBox);
  container.appendChild(statesRow);
}

/** 渲染玩家页：每个玩家一个属性卡片，从左到右排列。 */
function renderPlayerList() {
  const container = document.getElementById('playerList');
  if (!container) return;
  container.innerHTML = '';

  const players = Object.entries(state.players || {});
  if (players.length === 0) {
    container.innerHTML = '<div class="player-empty">暂无玩家</div>';
    return;
  }

  for (const [playerId, player] of players) {
    const card = document.createElement('div');
    card.className = 'player-card' + (playerId === selectedObjectId ? ' selected' : '');
    card.onclick = (e) => {
      // 卡片内的输入框/按钮操作不触发选中（避免输入框失焦）
      if (e.target.closest('input, button')) return;
      selectObject(playerId);
    };

    // 卡片标题：玩家名
    const title = document.createElement('div');
    title.className = 'player-card-title';
    const name = document.createElement('span');
    name.className = 'player-card-name';
    name.textContent = player.name || playerId;
    title.appendChild(name);
    card.appendChild(title);

    // 属性：ID / 地图 / 位置
    addPropertyRow(card, 'ID', playerId);
    addPropertyRow(card, '地图', player.mapName || '-');
    addPropertyRow(card, '位置', fmtPos(player.position));

    // 物品编辑 + 状态切换（与地图页属性面板一致）
    const obj = state.objects && state.objects[playerId];
    renderObjectItems(card, playerId, (obj && obj.items) || []);
    renderObjectStates(card, playerId, obj || { states: [], currentState: null });

    container.appendChild(card);
  }
}

/** 渲染对象物品列表：标签 + 移除按钮 + 输入框添加，变更即发送 gm_set_object_items 同步。 */
function renderObjectItems(container, objectId, items) {
  const row = document.createElement('div');
  row.className = 'property-row';
  const label = document.createElement('span');
  label.className = 'property-label';
  label.textContent = '物品';
  const box = document.createElement('div');
  box.className = 'property-items';

  const chips = document.createElement('div');
  chips.className = 'property-item-chips';
  if (items.length === 0) {
    const empty = document.createElement('span');
    empty.className = 'property-hint';
    empty.textContent = '暂无物品';
    chips.appendChild(empty);
  } else {
    for (const item of items) {
      const chip = document.createElement('span');
      chip.className = 'property-item-chip';

      const text = document.createElement('span');
      text.textContent = item;

      const remove = document.createElement('button');
      remove.className = 'property-item-remove';
      remove.title = '移除';
      remove.textContent = '×';
      remove.onclick = () => {
        send({
          type: 'gm_set_object_items',
          objectId,
          items: items.filter((i) => i !== item),
        });
      };

      chip.appendChild(text);
      chip.appendChild(remove);
      chips.appendChild(chip);
    }
  }

  const addBox = document.createElement('div');
  addBox.className = 'property-item-add';
  const input = document.createElement('input');
  input.className = 'property-item-input';
  input.placeholder = '输入物品名';
  input.maxLength = 40;
  const addBtn = document.createElement('button');
  addBtn.className = 'state-btn';
  addBtn.textContent = '添加';
  addBtn.onclick = () => {
    const value = input.value.trim();
    if (!value) return;
    send({
      type: 'gm_set_object_items',
      objectId,
      items: items.concat([value]),
    });
    input.value = '';
  };
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addBtn.click();
  });

  addBox.appendChild(input);
  addBox.appendChild(addBtn);

  box.appendChild(chips);
  box.appendChild(addBox);
  row.appendChild(label);
  row.appendChild(box);
  container.appendChild(row);
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
