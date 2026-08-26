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
    log('已连接服务器');
  };

  ws.onclose = () => {
    setStatus(false);
    log('连接断开，2 秒后重连...');
    setTimeout(connect, 2000);
  };

  ws.onerror = () => {
    log('连接错误');
  };

  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.type === 'gm_update' || msg.type === 'sync_state') {
      state = msg.state;
      render();
    }
    log(`<- ${ev.data}`);
  };
}

function setStatus(connected) {
  const el = document.getElementById('connectionStatus');
  el.className = `status ${connected ? 'connected' : 'disconnected'}`;
  el.textContent = connected ? '已连接' : '未连接';
}

function log(text) {
  const el = document.getElementById('log');
  const line = document.createElement('div');
  line.textContent = `[${new Date().toLocaleTimeString()}] ${text}`;
  el.appendChild(line);
  el.scrollTop = el.scrollHeight;
  while (el.childNodes.length > 200) el.removeChild(el.firstChild);
}

function send(msg) {
  log(`-> ${JSON.stringify(msg)}`);
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  } else {
    log('发送失败：未连接');
  }
}

// ---------- 渲染 ----------

function render() {
  if (!state) return;

  document.getElementById('currentMap').textContent = state.currentMap || '-';
  document.getElementById('posX').textContent = state.player?.position?.x ?? '-';
  document.getElementById('posY').textContent = state.player?.position?.y ?? '-';

  renderMapTabs();
  renderMap();
  renderDoorTable();
  populateTeleportOptions();
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
  return state.currentMap || 'Map001';
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
}

function toggleDoor(doorId, currentlyUnlocked) {
  if (currentlyUnlocked) {
    send({ type: 'gm_close_door', doorId });
  } else {
    send({ type: 'gm_open_door', doorId });
  }
}

// ---------- 门列表 ----------

function renderDoorTable() {
  const tbody = document.getElementById('doorTable');
  tbody.innerHTML = '';
  for (const [id, door] of Object.entries(state.doors || {})) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${id}</td>
      <td>${door.mapName}</td>
      <td>${door.isPortal ? '→ ' : ''}${door.targetMap}/${door.targetSpawn}</td>
      <td>${door.unlocked ? '已开启' : '锁定'}</td>
      <td></td>
    `;
    const cell = tr.lastElementChild;
    if (door.unlocked) {
      const closeBtn = document.createElement('button');
      closeBtn.textContent = '关门';
      closeBtn.onclick = () => send({ type: 'gm_close_door', doorId: id });
      cell.appendChild(closeBtn);
    } else {
      const openBtn = document.createElement('button');
      openBtn.textContent = '开门';
      openBtn.onclick = () => send({ type: 'gm_open_door', doorId: id });
      cell.appendChild(openBtn);
    }
    tbody.appendChild(tr);
  }
}

// ---------- 传送 ----------

function populateTeleportOptions() {
  if (!state) return;
  const mapSelect = document.getElementById('teleportMap');
  const spawnSelect = document.getElementById('teleportSpawn');

  mapSelect.innerHTML = '';
  for (const map of knownMaps()) {
    const opt = document.createElement('option');
    opt.value = map;
    opt.textContent = map;
    mapSelect.appendChild(opt);
  }
  mapSelect.value = state.currentMap || mapSelect.value;

  function updateSpawns() {
    const selected = mapSelect.value;
    const spawns = (state.spawnPoints && state.spawnPoints[selected]) || [];
    spawnSelect.innerHTML = '';
    if (spawns.length === 0) {
      const opt = document.createElement('option');
      opt.value = 'Default';
      opt.textContent = 'Default';
      spawnSelect.appendChild(opt);
    } else {
      for (const s of spawns) {
        const opt = document.createElement('option');
        opt.value = s.id;
        opt.textContent = s.id;
        spawnSelect.appendChild(opt);
      }
    }
  }

  mapSelect.onchange = updateSpawns;
  updateSpawns();
}

// ---------- 事件绑定 ----------

document.getElementById('btnTeleport').onclick = () => {
  const map = document.getElementById('teleportMap').value;
  const spawn = document.getElementById('teleportSpawn').value;
  send({ type: 'gm_teleport_player', mapName: map, spawnId: spawn });
};

document.getElementById('btnRefresh').onclick = () => {
  send({ type: 'gm_refresh' });
};

connect();
