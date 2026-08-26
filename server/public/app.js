const wsUrl = `ws://${location.host}/gm`;
let ws;
let state = null;
let selectedMap = null;
let lastManualMapPick = 0;

// ---- 网格编辑状态 ----
let editMode = false;
let editBrush = 1; // 1=障碍 0=擦除
let editingCells = null; // 当前编辑中的格子副本 {gridSizeX, gridSizeY, cells}
let painting = false;

// ---------- WebSocket ----------

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
  updateToolbar();
}

function knownMaps() {
  const maps = new Set(Object.keys(state.spawnPoints || {}));
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
      if (editMode && !confirm(`切换到 ${map}？未保存的网格修改将丢失。`)) return;
      selectedMap = map;
      lastManualMapPick = Date.now();
      renderMapTabs();
      renderMap();
      updateToolbar();
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

  if (editMode) {
    drawGridCanvas();
    return;
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

// ---------- 网格编辑 ----------

async function enterEditMode() {
  const map = effectiveMap();
  let grid = await loadGrid(map);
  if (!grid) {
    // 该地图还没有网格数据，创建默认 64x36 空网格（对应 1920x1080 图片，30px/格）
    if (!confirm(`${map} 还没有网格数据。创建默认 64x36 空网格开始编辑？`)) return;
    grid = { gridSizeX: 64, gridSizeY: 36, cells: new Array(64 * 36).fill(0) };
  }
  editMode = true;
  editingCells = { gridSizeX: grid.gridSizeX, gridSizeY: grid.gridSizeY, cells: [...grid.cells] };
  document.getElementById('doorLayer').style.display = 'none';
  updateToolbar();
  renderMap();
}

function exitEditMode() {
  editMode = false;
  editingCells = null;
  painting = false;
  document.getElementById('gridCanvas').hidden = true;
  document.getElementById('doorLayer').style.display = '';
  updateToolbar();
  renderMap();
}

function updateToolbar() {
  document.getElementById('btnViewMode').classList.toggle('active', !editMode);
  document.getElementById('btnEditMode').classList.toggle('active', editMode);
  const editing = editMode;
  document.getElementById('btnBrushObstacle').disabled = !editing;
  document.getElementById('btnBrushErase').disabled = !editing;
  document.getElementById('btnSaveGrid').disabled = !editing;
  document.getElementById('btnCancelEdit').disabled = !editing;
  document.getElementById('btnBrushObstacle').classList.toggle('active', editing && editBrush === 1);
  document.getElementById('btnBrushErase').classList.toggle('active', editing && editBrush === 0);
  document.getElementById('editHint').textContent = editMode
    ? `编辑 ${effectiveMap()}：拖拽绘制${editBrush === 1 ? '障碍' : '擦除'}，完成后点「保存网格」`
    : '';
}

async function loadGrid(map) {
  try {
    const res = await fetch(`/api/maps/${map}/grid`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function drawGridCanvas() {
  const canvas = document.getElementById('gridCanvas');
  const container = document.getElementById('mapContainer');
  canvas.hidden = false;
  canvas.width = container.clientWidth;
  canvas.height = container.clientHeight;

  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (!editingCells) return;

  const { gridSizeX, gridSizeY, cells } = editingCells;
  const cellW = canvas.width / gridSizeX;
  const cellH = canvas.height / gridSizeY;

  // 填充障碍格
  ctx.fillStyle = 'rgba(220, 38, 38, 0.55)';
  for (let y = 0; y < gridSizeY; y++) {
    for (let x = 0; x < gridSizeX; x++) {
      const mask = cells[y * gridSizeX + x];
      if (mask === 1) {
        ctx.fillRect(x * cellW, y * cellH, cellW + 0.5, cellH + 0.5);
      }
    }
  }

  // 网格线
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x <= gridSizeX; x++) {
    ctx.moveTo(x * cellW, 0);
    ctx.lineTo(x * cellW, canvas.height);
  }
  for (let y = 0; y <= gridSizeY; y++) {
    ctx.moveTo(0, y * cellH);
    ctx.lineTo(canvas.width, y * cellH);
  }
  ctx.stroke();
}

function eventToCell(e) {
  const canvas = document.getElementById('gridCanvas');
  const rect = canvas.getBoundingClientRect();
  if (!editingCells) return null;
  const x = Math.floor(((e.clientX - rect.left) / rect.width) * editingCells.gridSizeX);
  const y = Math.floor(((e.clientY - rect.top) / rect.height) * editingCells.gridSizeY);
  if (x < 0 || x >= editingCells.gridSizeX || y < 0 || y >= editingCells.gridSizeY) return null;
  return { x, y };
}

function paintCell(e) {
  const cell = eventToCell(e);
  if (!cell || !editingCells) return;
  const index = cell.y * editingCells.gridSizeX + cell.x;
  editingCells.cells[index] = editBrush; // 1=障碍 0=擦除
  drawGridCanvas();
}

async function saveGridToServer() {
  if (!editingCells) return;
  const map = effectiveMap();
  const res = await fetch(`/api/maps/${map}/grid`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(editingCells),
  });
  if (res.ok) {
    log(`网格已保存：${map} (${editingCells.gridSizeX}x${editingCells.gridSizeY})`);
    exitEditMode();
  } else {
    log(`保存失败：${res.status} ${await res.text()}`);
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

document.getElementById('btnEditMode').onclick = () => {
  if (!editMode) enterEditMode();
};

document.getElementById('btnViewMode').onclick = () => {
  if (editMode && !confirm('退出编辑？未保存的网格修改将丢失。')) return;
  exitEditMode();
};

document.getElementById('btnBrushObstacle').onclick = () => {
  editBrush = 1;
  updateToolbar();
};

document.getElementById('btnBrushErase').onclick = () => {
  editBrush = 0;
  updateToolbar();
};

document.getElementById('btnSaveGrid').onclick = () => {
  saveGridToServer();
};

document.getElementById('btnCancelEdit').onclick = () => {
  exitEditMode();
};

// canvas 绘制事件
const gridCanvas = document.getElementById('gridCanvas');
gridCanvas.addEventListener('pointerdown', (e) => {
  if (!editMode) return;
  painting = true;
  gridCanvas.setPointerCapture(e.pointerId);
  paintCell(e);
});
gridCanvas.addEventListener('pointermove', (e) => {
  if (editMode && painting) paintCell(e);
});
gridCanvas.addEventListener('pointerup', () => {
  painting = false;
});
gridCanvas.addEventListener('pointercancel', () => {
  painting = false;
});

window.addEventListener('resize', () => {
  if (editMode) drawGridCanvas();
});

connect();
