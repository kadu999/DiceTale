const wsUrl = `ws://${location.host}/gm`;
let ws;
let state = null;
let selectedMap = null;
let lastManualMapPick = 0;
let apiMaps = []; // GET /api/maps 返回的所有可观看地图 [{name, image}]

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
  renderPlayerList();
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
const ICON_DOOR =
  '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
  '<rect x="4" y="3" width="16" height="18" rx="2"/>' +
  '<line x1="7" y1="7" x2="7" y2="17"/>' +
  '<circle cx="14.5" cy="12" r="1.4" fill="#fff" stroke="none"/>' +
  '</svg>';

const ICON_PORTAL =
  '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
  '<path d="M4 21V10a8 8 0 0 1 16 0v11"/>' +
  '<circle cx="12" cy="10" r="3.2" fill="#fff" stroke="none" opacity="0.75"/>' +
  '</svg>';

const ICON_PLAYER =
  '<svg viewBox="0 0 24 24" width="16" height="16" fill="#fff">' +
  '<circle cx="12" cy="7.5" r="3.5"/>' +
  '<path d="M4.5 21c0-4.1 3.4-7 7.5-7s7.5 2.9 7.5 7"/>' +
  '</svg>';

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

  const layer = document.getElementById('doorLayer');
  layer.innerHTML = '';

  // 门标记（客户端上报的位置）
  for (const [id, door] of Object.entries(state.doors || {})) {
    if (door.mapName !== map) continue;

    const marker = document.createElement('button');
    marker.className = `door-marker ${door.unlocked ? 'unlocked' : 'locked'}`;
    marker.title = `${id}\n${door.isPortal ? '传送门' : '普通门'} → ${door.targetMap} / ${door.targetSpawn}\n${door.unlocked ? '已开启（点击关闭）' : '锁定（点击开启）'}`;
    marker.innerHTML = door.isPortal ? ICON_PORTAL : ICON_DOOR;
    marker.style.left = `${num(door.position && door.position.x, 0.5) * 100}%`;
    marker.style.top = `${num(door.position && door.position.y, 0.5) * 100}%`;
    marker.onclick = () => toggleDoor(id, door.unlocked);
    layer.appendChild(marker);
  }

  // 玩家标记（每个玩家一个，显示在其所在的地图上）
  for (const [playerId, player] of Object.entries(state.players || {})) {
    if (player.mapName !== map) continue;

    const marker = document.createElement('div');
    marker.className = 'player-marker';
    marker.title = player.name || playerId;
    marker.innerHTML = ICON_PLAYER;
    marker.style.left = `${num(player.position && player.position.x, 0.5) * 100}%`;
    marker.style.top = `${num(player.position && player.position.y, 0.5) * 100}%`;
    layer.appendChild(marker);
  }
}

function renderPlayerList() {
  const container = document.getElementById('playerList');
  container.innerHTML = '';

  const players = Object.entries(state.players || {});
  if (players.length === 0) {
    container.innerHTML = '<div class="player-row empty">暂无玩家</div>';
    return;
  }

  for (const [playerId, player] of players) {
    const row = document.createElement('div');
    row.className = 'player-row';
    row.innerHTML = `
      <i class="marker-dot player"></i>
      <span class="player-name">${player.name || playerId}</span>
      <span class="player-info">${player.mapName} · ${fmtPos(player.position)}</span>
    `;
    container.appendChild(row);
  }
}

function fmtPos(pos) {
  if (!pos) return '-';
  return `(${pos.x.toFixed(2)}, ${pos.y.toFixed(2)})`;
}

function toggleDoor(doorId, currentlyUnlocked) {
  send({
    type: currentlyUnlocked ? 'gm_close_door' : 'gm_open_door',
    doorId,
  });
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
