const wsUrl = `ws://${location.host}/gm`;
let ws;
let state = null;
let selectedMap = null;
let apiMaps = []; // GET /api/maps 返回的所有可观看地图 [{name, image}]
let selectedObjectId = null; // 当前选中的目标（对象 ID）
let clientConnected = false; // 客户端（Unity）是否在线，来自 gm_update.clientConnected

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

let activePage = 'map'; // 'map' | 'players' | 'items'

/** 切换大页面（地图 / 玩家 / 道具）。 */
function switchPage(page) {
  activePage = page === 'players' || page === 'items' ? page : 'map';
  document.getElementById('pageMap').classList.toggle('active', activePage === 'map');
  document.getElementById('pagePlayers').classList.toggle('active', activePage === 'players');
  document.getElementById('pageItems').classList.toggle('active', activePage === 'items');
  document.getElementById('pageBtnMap').classList.toggle('active', activePage === 'map');
  document.getElementById('pageBtnPlayers').classList.toggle('active', activePage === 'players');
  document.getElementById('pageBtnItems').classList.toggle('active', activePage === 'items');
  renderPropertyPanel();
  if (activePage === 'players') {
    renderPlayerList();
  } else if (activePage === 'items') {
    renderItemPage();
  } else {
    setTimeout(fitLayout, 50); // 地图页重新显示后重算地图尺寸与属性面板等高
  }
}

function render() {
  if (!state) return;
  renderMapTabs();
  renderMap();
  renderPlayerList();
  renderItemPage();
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
function fmtPos(pos) {
  if (!pos) return '-';
  return `(${pos.x.toFixed(2)}, ${pos.y.toFixed(2)})`;
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
