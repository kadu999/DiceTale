// 页面始终由后端同源托管：
//   - PC：serve-web.bat 启动后端，浏览器打开 http://localhost:1420/（后端直接托管页面）
//   - Android：Tauri 壳引导页跳转到电脑局域网地址（http://192.168.x.x:1420）
// 因此后端地址恒等于 location.origin，不再需要 config.js 的地址优先级逻辑，
// 也不需要 Tauri 转发桥（同源后 CORS 消失）。改端口/换机器只需改后端 server/config.json。
const backendBase = location.origin;

/** 后端资源完整 URL（地图图片、items.json、api 等）。 */
function backendUrl(path) {
  return backendBase + path;
}

/** 同源 GET 取 JSON（地图列表 / 道具目录）。 */
async function backendFetchJson(path) {
  const resp = await fetch(backendUrl(path));
  return resp.json();
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
    setTimeout(fitLayout, 50); // 地图页重新显示后重算标记位置
  }
}

function render() {
  if (!state) return;
  renderMapTabs();
  renderMap();
  renderPlayerList();
  renderItemPage();
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
// ---- 布局全部由 CSS 负责（移动端单列堆叠 / 桌面三栏，见 css/gm.css）。
// 这里只做一件事：窗口尺寸变化 / 页面切换后按图片实际矩形重定位标记。----
function fitLayout() {
  if (typeof repositionMarkers === 'function') repositionMarkers();
}
