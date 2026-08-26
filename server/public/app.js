const wsUrl = `ws://${location.host}/gm`;
let ws;
let state = null;

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
  const time = new Date().toLocaleTimeString();
  line.textContent = `[${time}] ${text}`;
  el.appendChild(line);
  el.scrollTop = el.scrollHeight;
  while (el.childNodes.length > 200) el.removeChild(el.firstChild);
}

function render() {
  if (!state) return;

  document.getElementById('currentMap').textContent = state.currentMap || '-';
  document.getElementById('posX').textContent = state.player?.position?.x ?? '-';
  document.getElementById('posY').textContent = state.player?.position?.y ?? '-';

  const tbody = document.getElementById('doorTable');
  tbody.innerHTML = '';
  for (const [id, door] of Object.entries(state.doors || {})) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${id}</td>
      <td>${door.targetMap}</td>
      <td>${door.targetSpawn}</td>
      <td>${door.unlocked ? '已开启' : '锁定'}</td>
      <td><button ${door.unlocked ? 'disabled' : ''}>开门</button></td>
    `;
    const btn = tr.querySelector('button');
    btn.onclick = () => send({ type: 'gm_open_door', doorId: id });
    tbody.appendChild(tr);
  }

  populateTeleportOptions();
}

function populateTeleportOptions() {
  if (!state) return;
  const mapSelect = document.getElementById('teleportMap');
  const spawnSelect = document.getElementById('teleportSpawn');

  const knownMaps = new Set([state.currentMap]);
  for (const door of Object.values(state.doors || {})) {
    knownMaps.add(door.targetMap);
  }
  for (const map of Object.keys(state.spawnPoints || {})) {
    knownMaps.add(map);
  }

  mapSelect.innerHTML = '';
  for (const map of knownMaps) {
    const opt = document.createElement('option');
    opt.value = map;
    opt.textContent = map;
    mapSelect.appendChild(opt);
  }

  function updateSpawns() {
    const selectedMap = mapSelect.value;
    const spawns = (state.spawnPoints && state.spawnPoints[selectedMap]) || [];
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

function send(msg) {
  log(`-> ${JSON.stringify(msg)}`);
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  } else {
    log('发送失败：未连接');
  }
}

document.getElementById('btnTeleport').onclick = () => {
  const map = document.getElementById('teleportMap').value;
  const spawn = document.getElementById('teleportSpawn').value;
  send({ type: 'gm_teleport_player', mapName: map, spawnId: spawn });
};

document.getElementById('btnRefresh').onclick = () => {
  send({ type: 'gm_refresh' });
};

connect();
