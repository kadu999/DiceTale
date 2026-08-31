// 后端地址确定优先级（前端无设置界面，地址来自 config.js 配置）：
//   1) config.js 里 window.DICETALE_BACKEND_URL 有值 → 强制使用（手机连电脑填局域网 IP）
//   2) 页面由后端同源托管（location.origin === DICETALE_BACKEND_FALLBACK）→ 直接同源
//   3) DICETALE_BACKEND_FALLBACK（默认 http://localhost:1420，Tauri 壳 PC / 1421 预览页使用；
//      后端端口改动时需同步修改该配置）
const BACKEND_FALLBACK = (window.DICETALE_BACKEND_FALLBACK || 'http://localhost:1420').replace(/\/+$/, '');
let backendBase = (function () {
  if (window.DICETALE_BACKEND_URL) return window.DICETALE_BACKEND_URL.replace(/\/+$/, '');
  if ((location.protocol === 'http:' || location.protocol === 'https:') && location.origin === BACKEND_FALLBACK) {
    return location.origin;
  }
  return BACKEND_FALLBACK;
})();

/** 后端资源完整 URL（地图图片、items.json、api 等）。 */
function backendUrl(path) {
  return backendBase + path;
}

let ws;
let state = null;
let selectedMap = null;
let apiMaps = []; // GET /api/maps 返回的所有可观看地图 [{name, image}]
let selectedObjectId = null; // 当前选中的目标（对象 ID）
let clientConnected = false; // 客户端（Unity）是否在线，来自 gm_update.clientConnected

/** 当前 WebSocket 地址（后端地址变化后重新计算）。 */
function currentWsUrl() {
  return backendBase.replace(/^http/, 'ws') + '/gm';
}

/** 拉取后端目录数据（地图列表 + 道具目录），幂等可重复调用。 */
function refreshBackendData() {
  backendFetchJson('/api/maps')
    .then((data) => {
      apiMaps = (data && data.maps) || [];
      if (state) render();
    })
    .catch(() => {});
  backendFetchJson('/items.json')
    .then((data) => {
      itemCatalog = (data && data.items) || [];
      if (state) render();
    })
    .catch(() => {});
}

function connect() {
  ws = new WebSocket(currentWsUrl());

  ws.onopen = () => {
    setStatus(true);
    // 后端刚启动时首次拉取可能失败，连接建立后补拉一次目录数据
    refreshBackendData();
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
    if (msg.type === 'gm_update') {
      state = msg.state;
      if (typeof msg.clientConnected === 'boolean') {
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
  el.className = 'badge ' + (connected ? 'text-bg-success' : 'text-bg-danger');
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
  if (!el) return;
  el.className = 'badge ' + (connected ? 'text-bg-success' : 'text-bg-danger');
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
// ---- 横屏时地图按 16:9 等比（宽高都由比例决定，宽度受父容器限制），避免 contain 黑边 ----
function fitMapContainer() {
  var container = document.getElementById('mapContainer');
  if (!container) return;

  var isLandscape = window.matchMedia('(orientation: landscape)').matches;
  if (isLandscape) {
    var maxW = container.parentElement.clientWidth;
    var maxH = (window.innerHeight || document.documentElement.clientHeight) - 80; // 与 CSS calc(100dvh - 80px) 一致
    var w = Math.min(maxW, Math.max(0, Math.round(maxH * 16 / 9)));
    container.style.width = w + 'px';
    container.style.height = Math.round(w * 9 / 16) + 'px';
  } else {
    container.style.width = '';
    container.style.height = '';
  }
}

/** 属性面板高度 = 地图所在框（mapContainer）的实际高度，保证两栏等高。
 *  仅三列网格布局（横屏且宽度充足）下生效；手机/窄屏堆叠布局用自然高度。 */
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

  if (window.matchMedia('(orientation: landscape) and (min-width: 640px)').matches) {
    propertyPanel.style.height = mapContainer.clientHeight + 'px';
  } else {
    propertyPanel.style.height = '';
  }
}

/** 地图尺寸 + 属性面板等高 + 标记位置一起刷新。 */
function fitLayout() {
  fitMapContainer();
  syncPropertyHeight();
  if (typeof repositionMarkers === 'function') repositionMarkers();
}

/** 关闭横屏建议（点击提示条）。 */
function dismissRotateHint() {
  var el = document.getElementById('rotateHint');
  if (el) el.style.display = 'none';
}
// 横屏建议只短暂提示，超时自动消失，不长期占屏
setTimeout(dismissRotateHint, 8000);
