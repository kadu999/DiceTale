const wsUrl = `ws://${location.host}/gm`;
let ws;
let state = null;
let selectedMap = null;
let apiMaps = []; // GET /api/maps 返回的所有可观看地图 [{name, image}]
let selectedObjectId = null; // 当前选中的目标（对象 ID）
let clientConnected = false; // 客户端（Unity）是否在线，来自 gm_update.clientConnected

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
    setClientStatus(false); // 断线期间不显示过期的"客户端在线"
    setTimeout(connect, 2000);
  };

  ws.onerror = () => {};

  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.type === 'gm_error') {
      showToast(msg.reason || '操作失败');
      return;
    }
    if (msg.type === 'gm_update' || msg.type === 'sync_state') {
      state = msg.state;
      if (msg.type === 'gm_update' && typeof msg.clientConnected === 'boolean') {
        clientConnected = msg.clientConnected;
        setClientStatus(clientConnected);
      }
      render();
    }
  };
}

/** 客户端（Unity）在线状态灯。 */
function setClientStatus(connected) {
  const el = document.getElementById('clientStatus');
  if (!el) return;
  el.className = `status ${connected ? 'connected' : 'disconnected'}`;
  el.textContent = connected ? '客户端已连接' : '客户端未连接';
}

/** 底部轻提示（操作失败等原因）。 */
function showToast(text) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => {
    el.classList.remove('show');
  }, 3000);
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
    setTimeout(fitLayout, 50); // 地图页重新显示后重算地图尺寸与属性面板等高
  }
}

function render() {
  if (!state) return;
  renderMapTabs();
  renderMap();
  renderPlayerList();
  renderPropertyPanel();
  syncPropertyHeight(); // 属性面板重新渲染后保持与地图框等高
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

/** 选中目标：地图标记与玩家列表同步高亮，属性面板显示属性。 */
function selectObject(objectId) {
  selectedObjectId = objectId;
  renderMap();
  renderPlayerList();
  renderPropertyPanel();
}

function renderMap() {
  // 不自动跟随客户端切图：显示的哪个地图只由手动切换决定（首次默认客户端当前地图）
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
    const remaining = itemRemaining(obj);
    label.textContent = remaining != null ? `${obj.itemName} ×${remaining}` : (obj.name || objectId);

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

    marker.textContent = player.name || playerId;
    marker.onclick = () => {
      if (state.objects && state.objects[playerId]) selectObject(playerId);
    };
    layer.appendChild(marker);
    fitPlayerName(marker);
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

function fmtPos(pos) {
  if (!pos) return '-';
  return `(${pos.x.toFixed(2)}, ${pos.y.toFixed(2)})`;
}

// ---------- 属性列表（右侧） ----------

/** 渲染选中目标的属性：基础信息 + 物品 + 可修改的状态切换按钮（属于地图页）。 */
function renderPropertyPanel() {
  renderPropertyPanelInto('propertyListMap');
}

/** 渲染选中目标的属性：基本信息 + 物品/道具 + 状态（分区展示，地图页右侧）。 */
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

  // 基本信息
  const info = propertySection(container, '基本信息');
  addPropertyRow(info, '名称', obj.name || selectedObjectId);
  addPropertyRow(info, 'ID', selectedObjectId);
  addPropertyRow(info, '位置', fmtPos(obj.position));

  // 道具对象：玩家分配列表（内部自带「分配道具（剩余 N）」标题）；普通对象：物品编辑
  if (obj.kind === 'ItemObject' || obj.itemName) {
    renderItemDistribution(propertySection(container), obj);
  } else {
    renderObjectItems(propertySection(container, '物品'), selectedObjectId, obj.items || [], null);
  }

  // 状态（未配置状态列表时不显示整个区）
  if (((obj.states) || []).length > 0) {
    renderObjectStates(propertySection(container, '状态'), selectedObjectId, obj, null);
  }
}

/** 创建属性分区（可选标题；无标题时只作为分组容器）。 */
function propertySection(container, title) {
  const section = document.createElement('section');
  section.className = 'property-section';
  if (title) {
    const h = document.createElement('div');
    h.className = 'property-section-title';
    h.textContent = title;
    section.appendChild(h);
  }
  container.appendChild(section);
  return section;
}

/** 道具对象当前剩余数量 = 上报的总数 - 所有玩家已持有该道具的数量；非道具对象返回 null。后台乐观更新后即时重算。 */
function itemRemaining(obj) {
  if (!obj || !obj.itemName) return null;
  const total = obj.quantity || 0;
  let held = 0;
  for (const playerId of Object.keys(state.players || {})) {
    const items = (state.objects[playerId] && state.objects[playerId].items) || [];
    for (const it of items) {
      if (it === obj.itemName) held++;
    }
  }
  return Math.max(0, total - held);
}

/** 道具分配区：标题「分配道具（剩余 N）」单独一行，之后每个玩家一行 [-][玩家名][数量][+]（走 gm_set_object_items）。 */
function renderItemDistribution(container, obj) {
  const itemName = obj.itemName;
  const remaining = itemRemaining(obj);

  // 标题单独一行
  const title = document.createElement('div');
  title.className = 'property-distribute-title';
  title.textContent = remaining != null ? `分配道具（剩余 ${remaining}）` : '分配道具';
  container.appendChild(title);

  if (!itemName) {
    const hint = document.createElement('div');
    hint.className = 'property-hint';
    hint.textContent = '道具未配置名称（在客户端 Inspector 的 Item Name 里填写）';
    container.appendChild(hint);
    return;
  }

  const players = Object.entries(state.players || {});
  if (players.length === 0) {
    const hint = document.createElement('div');
    hint.className = 'property-hint';
    hint.textContent = '暂无玩家';
    container.appendChild(hint);
    return;
  }

  for (const [playerId, player] of players) {
    const playerItems = (state.objects[playerId] && state.objects[playerId].items) || [];
    const count = playerItems.filter((i) => i === itemName).length;

    const line = document.createElement('div');
    line.className = 'property-distribute-line';

    const minus = document.createElement('button');
    minus.className = 'state-btn';
    minus.title = '收回一个';
    minus.textContent = '−';
    minus.onclick = () => {
      const next = playerItems.slice();
      const idx = next.indexOf(itemName);
      if (idx >= 0) next.splice(idx, 1);
      send({ type: 'gm_set_object_items', objectId: playerId, items: next });
    };

    const nameEl = document.createElement('span');
    nameEl.className = 'property-distribute-name';
    nameEl.title = player.name || playerId;
    nameEl.textContent = player.name || playerId;

    const countEl = document.createElement('span');
    countEl.className = 'property-distribute-count';
    countEl.textContent = count;

    const plus = document.createElement('button');
    plus.className = 'state-btn property-distribute-plus';
    plus.title = '分配一个';
    plus.textContent = '+';
    plus.disabled = remaining != null && remaining <= 0; // 库存不足不可分配
    plus.onclick = () => {
      send({ type: 'gm_set_object_items', objectId: playerId, items: playerItems.concat([itemName]) });
    };

    line.appendChild(minus);
    line.appendChild(nameEl);
    line.appendChild(countEl);
    line.appendChild(plus);
    container.appendChild(line);

    // 玩家名固定宽度放不下时缩小字号，保持一行
    fitDistributeName(nameEl);
  }
}

/** 玩家名在固定宽度内自动缩小字号：太长时缩小，保持一行不换行。 */
function fitDistributeName(el) {
  var size = 13;
  el.style.fontSize = size + 'px';
  var maxWidth = el.clientWidth - 4;
  var range = document.createRange();
  range.selectNodeContents(el);
  while (range.getBoundingClientRect().width > maxWidth && size > 7) {
    size -= 1;
    el.style.fontSize = size + 'px';
  }
}

/** 渲染状态切换区（属性面板与玩家卡片共用）；对象未配置状态列表时不显示。
 *  labelText 为空时省略左侧标签（配合分区标题使用）。 */
function renderObjectStates(container, objectId, obj, labelText) {
  const states = (obj && obj.states) || [];
  if (states.length === 0) {
    return; // 未配置状态列表：整个「切换状态」区都不显示
  }

  const statesRow = document.createElement('div');
  statesRow.className = 'property-row';
  if (labelText) {
    const label = document.createElement('span');
    label.className = 'property-label';
    label.textContent = labelText;
    statesRow.appendChild(label);
  }
  const statesBox = document.createElement('div');
  statesBox.className = 'property-states';

  for (const stateName of states) {
    const btn = document.createElement('button');
    btn.className = 'state-btn' + (stateName === obj.currentState ? ' active' : '');
    btn.textContent = stateName;
    btn.onclick = () => {
      send({ type: 'gm_set_object_state', objectId, state: stateName });
    };
    statesBox.appendChild(btn);
  }

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

    // 标题：玩家名居中（与地图页属性面板一致）
    const title = document.createElement('div');
    title.className = 'property-title';
    title.textContent = player.name || playerId;
    card.appendChild(title);

    // 内容区：与属性面板同款，超高时面板内滚动
    const list = document.createElement('div');
    list.className = 'property-list';
    card.appendChild(list);

    // 基本信息
    const info = propertySection(list, '基本信息');
    addPropertyRow(info, 'ID', playerId);
    addPropertyRow(info, '地图', player.mapName || '-');
    addPropertyRow(info, '位置', fmtPos(player.position));

    // 物品编辑（与地图页属性面板一致的物品区）
    const obj = state.objects && state.objects[playerId];
    renderObjectItems(propertySection(list, '物品'), playerId, (obj && obj.items) || [], null);

    // 状态切换（未配置状态列表时不显示）
    if (((obj && obj.states) || []).length > 0) {
      renderObjectStates(propertySection(list, '状态'), playerId, obj || {}, null);
    }

    container.appendChild(card);
  }
}

/** 道具名总库存：所有同名道具对象的 quantity 之和；没有对应道具对象返回 0（不限制）。 */
function itemNameStock(name) {
  let stock = 0;
  for (const obj of Object.values(state.objects || {})) {
    if (obj.itemName === name) stock += obj.quantity || 0;
  }
  return stock;
}

/** 是否还能给玩家添加一个该道具（各玩家已持有总数 < 总库存时允许）。 */
function canAddItem(name) {
  const stock = itemNameStock(name);
  if (stock <= 0) return true;

  let held = 0;
  for (const playerId of Object.keys(state.players || {})) {
    const items = (state.objects[playerId] && state.objects[playerId].items) || [];
    for (const it of items) {
      if (it === name) held++;
    }
  }
  return held < stock;
}

/** 渲染对象物品列表：按道具名分组显示「道具名 ×数量」，移除按钮每次移除一个，输入框添加；变更即发送 gm_set_object_items 同步。
 *  labelText 为空时省略左侧标签（配合分区标题使用）。 */
function renderObjectItems(container, objectId, items, labelText) {
  const row = document.createElement('div');
  row.className = 'property-row';
  if (labelText) {
    const label = document.createElement('span');
    label.className = 'property-label';
    label.textContent = labelText;
    row.appendChild(label);
  }
  const box = document.createElement('div');
  box.className = 'property-items';

  const chips = document.createElement('div');
  chips.className = 'property-item-chips';

  // 按道具名分组统计数量：['铁剑','铁剑','草药'] → 铁剑 ×2、草药 ×1
  const counts = {};
  for (const item of items) {
    counts[item] = (counts[item] || 0) + 1;
  }
  const grouped = Object.entries(counts);

  if (grouped.length === 0) {
    const empty = document.createElement('span');
    empty.className = 'property-hint';
    empty.textContent = '暂无物品';
    chips.appendChild(empty);
  } else {
    for (const [name, count] of grouped) {
      const chip = document.createElement('span');
      chip.className = 'property-item-chip';

      const text = document.createElement('span');
      text.textContent = `${name} ×${count}`;

      const remove = document.createElement('button');
      remove.className = 'property-item-remove';
      remove.title = '移除一个';
      remove.textContent = '×';
      remove.onclick = () => {
        const next = items.slice();
        const idx = next.indexOf(name);
        if (idx >= 0) next.splice(idx, 1); // 每次只移除一个该道具
        send({ type: 'gm_set_object_items', objectId, items: next });
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
    input.value = '';
    if (!canAddItem(value)) {
      return; // 该道具已分配完（库存不足），不添加
    }
    send({
      type: 'gm_set_object_items',
      objectId,
      items: items.concat([value]),
    });
  };
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addBtn.click();
  });

  addBox.appendChild(input);
  addBox.appendChild(addBtn);

  box.appendChild(chips);
  box.appendChild(addBox);
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

/** 属性面板高度 = 地图所在框（mapContainer）的实际高度，保证两栏等高。 */
function syncPropertyHeight() {
  var mapContainer = document.getElementById('mapContainer');
  var propertyPanel = document.querySelector('.property-panel');
  if (!mapContainer || !propertyPanel) return;

  // 属性面板所在页不可见时不设置（兼容旧 WebView，避免依赖 closest）
  var page = propertyPanel;
  while (page && !(page.classList && page.classList.contains('page'))) {
    page = page.parentElement;
  }
  if (page && !page.classList.contains('active')) return;

  propertyPanel.style.height = mapContainer.clientHeight + 'px';
}

/** 地图尺寸 + 属性面板等高一起刷新。 */
function fitLayout() {
  fitMapContainer();
  syncPropertyHeight();
}

window.addEventListener('resize', fitLayout);
window.addEventListener('orientationchange', function () {
  setTimeout(fitLayout, 300);
});
setTimeout(fitLayout, 300);

connect();
