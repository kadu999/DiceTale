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
  return state.currentMap || apiMaps[0]?.name || 'Map001';
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

  const layer = document.getElementById('doorLayer');
  layer.innerHTML = '';

  // 门标记（客户端上报的位置）
  for (const [id, door] of Object.entries(state.doors || {})) {
    if (door.mapName !== map) continue;

    const marker = document.createElement('button');
    marker.className = `door-marker ${door.unlocked ? 'unlocked' : 'locked'}`;
    marker.title = `${id}\n${door.isPortal ? '传送门' : '普通门'} → ${door.targetMap} / ${door.targetSpawn}\n${door.unlocked ? '已开启（点击关闭）' : '锁定（点击开启）'}`;
    marker.textContent = door.isPortal ? '⦿' : '▣';
    marker.style.left = `${(door.position?.x ?? 0.5) * 100}%`;
    marker.style.top = `${(door.position?.y ?? 0.5) * 100}%`;
    marker.onclick = () => toggleDoor(id, door.unlocked);
    layer.appendChild(marker);
  }

  // 玩家标记（每个玩家一个，显示在其所在的地图上）
  for (const [playerId, player] of Object.entries(state.players || {})) {
    if (player.mapName !== map) continue;

    const marker = document.createElement('div');
    marker.className = 'player-marker';
    marker.title = player.name || playerId;
    marker.style.left = `${(player.position?.x ?? 0.5) * 100}%`;
    marker.style.top = `${(player.position?.y ?? 0.5) * 100}%`;
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

connect();
