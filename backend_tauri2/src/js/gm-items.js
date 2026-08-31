// 道具目录（GET /items.json，由 xlsx 转换而来）
let itemCatalog = []; // [{name, price, category, identify, usage}]
let selectedItem = null; // 当前选中的道具名
let itemSearch = '';
let itemCategory = ''; // 选中的类别（'' = 全部）
backendFetchJson('/items.json')
  .then((data) => {
    itemCatalog = (data && data.items) || [];
    if (selectedItem && !itemCatalog.some((it) => it.name === selectedItem)) {
      selectedItem = null;
    }
    populateItemCategories();
    if (state) render();
  })
  .catch(() => {});
/** 类别标签：从目录中去重所有类别并填充为可点击标签（含「全部」）。 */
function populateItemCategories() {
  fillCategoryTags(document.getElementById('itemCategory'), itemCategory, (c) => {
    itemCategory = c;
    renderItemList();
  });
}

/** 填充类别标签按钮（道具页与选择弹框共用）；active 为当前选中类别，onSelect 为点选回调。 */
function fillCategoryTags(container, active, onSelect) {
  if (!container) return;

  const categories = [];
  for (const it of itemCatalog) {
    const c = it.category || '—';
    if (categories.indexOf(c) < 0) categories.push(c);
  }
  categories.sort();

  container.innerHTML = '';

  const makeTag = (label, value) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'category-tag' + (value === active ? ' active' : '');
    btn.textContent = label;
    btn.onclick = () => {
      fillCategoryTags(container, value, onSelect);
      onSelect(value);
    };
    return btn;
  };

  container.appendChild(makeTag('全部', ''));
  for (const c of categories) {
    container.appendChild(makeTag(c, c));
  }
}
function itemNameStock(name) {
  let stock = 0;
  for (const obj of Object.values(state.objects || {})) {
    const params = exchangeParams(obj);
    if (params.itemName === name) stock += params.quantity || 0;
  }
  return stock;
}

/** 是否还能给玩家添加一个该道具（各玩家已持有总数 < 总库存时允许）。 */
function canAddItem(name) {
  const stock = itemNameStock(name);
  if (stock <= 0) return true;

  let held = 0;
  for (const playerId of Object.keys(state.players || {})) {
    const items = backpackItemsOf(state.objects[playerId]);
    for (const it of items) {
      if (it === name) held++;
    }
  }
  return held < stock;
}
// ---------- 道具页 ----------

function renderItemPage() {
  if (!state) {
    const el = document.getElementById('itemList');
    if (el) el.innerHTML = '<div class="property-empty">未连接服务器，等待数据…</div>';
    return;
  }
  renderItemList();
  renderItemDetail();
}

function renderItemList() {
  const container = document.getElementById('itemList');
  if (!container) return;
  container.innerHTML = '';

  const query = itemSearch.trim().toLowerCase();
  const filtered = itemCatalog.filter((it) => {
    if (itemCategory && (it.category || '—') !== itemCategory) return false;
    if (!query) return true;
    return (it.name || '').toLowerCase().includes(query) || (it.category || '').toLowerCase().includes(query);
  });

  if (filtered.length === 0) {
    container.innerHTML = '<div class="property-empty">无匹配道具</div>';
    return;
  }

  for (const item of filtered) {
    const row = document.createElement('button');
    row.className = 'item-row' + (item.name === selectedItem ? ' selected' : '');
    row.onclick = () => {
      selectedItem = item.name;
      renderItemList();
      renderItemDetail();
    };

    const nameEl = document.createElement('span');
    nameEl.className = 'item-row-name';
    nameEl.textContent = item.name;

    const priceEl = document.createElement('span');
    priceEl.className = 'item-row-price';
    priceEl.textContent = item.price != null ? '$' + fmtPrice(item.price) : '价格自定';

    row.appendChild(nameEl);
    row.appendChild(priceEl);
    container.appendChild(row);
  }
}

/** 价格显示：去掉多余小数位（0.2 → 0.2；1.0 → 1）。 */
function fmtPrice(p) {
  return String(Number(p.toFixed(2)));
}

function renderItemDetail() {
  renderItemInfo();
  renderItemAssignPanel();
}

/** 中列：选中道具的基本信息。 */
function renderItemInfo() {
  const container = document.getElementById('itemDetail');
  const title = document.getElementById('itemDetailTitle');
  if (!container || !title) return;

  const item = itemCatalog.find((it) => it.name === selectedItem);
  if (!item) {
    title.textContent = '选择道具';
    container.innerHTML = '<div class="property-empty">点击左侧道具查看信息</div>';
    return;
  }

  title.textContent = item.name;
  container.innerHTML = '';

  const info = propertySection(container, '基本信息');
  addPropertyRow(info, '类别', item.category || '—');
  addPropertyRow(info, '价格', item.price != null ? '$' + fmtPrice(item.price) : '价格自定');
  addPropertyRow(info, '鉴定', item.identify || '—');
  addPropertyRow(info, '模组用途', item.usage || '—');
}

/** 右列：选中道具的玩家分配面板。 */
function renderItemAssignPanel() {
  const container = document.getElementById('itemAssign');
  const title = document.getElementById('itemAssignTitle');
  if (!container || !title) return;

  const item = itemCatalog.find((it) => it.name === selectedItem);
  if (!item) {
    title.textContent = '分配';
    container.innerHTML = '<div class="property-empty">选择道具后分配</div>';
    return;
  }

  title.textContent = item.name;
  container.innerHTML = '';
  renderItemAssign(container, item);
}

/** 道具分配区：标题 + 每个玩家一行 [-][玩家名][数量][+]（走 gm_set_object_items，与地图页道具分配一致）。
 *  库存口径与地图页相同：场景中有同名道具对象（itemName）时按总库存限制，否则不限。 */
function renderItemAssign(container, item) {
  if (!state) return;

  const name = item.name;
  const stock = itemNameStock(name);
  const remaining = stock > 0 ? stock - heldItemCount(name) : null;

  const title = document.createElement('div');
  title.className = 'property-distribute-title';
  title.textContent = remaining != null ? '分配道具（剩余 ' + remaining + '）' : '分配道具';
  container.appendChild(title);

  const players = Object.entries(state.players || {});
  if (players.length === 0) {
    const hint = document.createElement('div');
    hint.className = 'property-hint';
    hint.textContent = '暂无玩家';
    container.appendChild(hint);
    return;
  }

  for (const [playerId, player] of players) {
    const playerItems = backpackItemsOf(state.objects[playerId]);
    const count = playerItems.filter((i) => i === name).length;

    const line = document.createElement('div');
    line.className = 'property-distribute-line';

    const minus = document.createElement('button');
    minus.className = 'state-btn';
    minus.title = '收回一个';
    minus.textContent = '−';
    minus.onclick = () => {
      const next = playerItems.slice();
      const idx = next.indexOf(name);
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
    plus.disabled = remaining != null && remaining <= 0; // 有库存且已分完时不可再分
    plus.onclick = () => {
      send({ type: 'gm_set_object_items', objectId: playerId, items: playerItems.concat([name]) });
    };

    line.appendChild(minus);
    line.appendChild(nameEl);
    line.appendChild(countEl);
    line.appendChild(plus);
    container.appendChild(line);
  }
}

/** 所有玩家持有的某道具总数。 */
function heldItemCount(name) {
  let held = 0;
  for (const playerId of Object.keys(state.players || {})) {
    const items = backpackItemsOf(state.objects[playerId]);
    for (const it of items) {
      if (it === name) held++;
    }
  }
  return held;
}
// ---------- 道具选择弹框 ----------

let pickerTargetId = null; // 弹框要添加道具的目标对象 ID
let pickerCurrentItems = []; // 打开弹框时目标的当前物品列表快照
let pickerSelectedItem = null; // 弹框中当前选中的道具名（点「确定」才添加）
let pickerSearch = '';
let pickerCategory = '';

/** 读取弹框数量输入（1~99），并更新确定按钮文案（×N）。 */
function readPickerQty() {
  const el = document.getElementById('pickerQty');
  const v = el ? parseInt(el.value, 10) : NaN;
  return Math.max(1, Math.min(99, v || 1));
}

function updatePickerConfirmText() {
  const confirmBtn = document.getElementById('pickerConfirm');
  if (!confirmBtn) return;
  const n = readPickerQty();
  confirmBtn.textContent = n > 1 ? '确定（×' + n + '）' : '确定';
}

/** 打开道具选择弹框：从道具目录点选一个道具，在弹框内设数量，点「确定」添加到目标（玩家/普通对象）背包。 */
function openItemPicker(objectId) {
  const obj = state && state.objects && state.objects[objectId];
  if (!obj) {
    showToast('目标数据未同步，无法添加道具');
    return;
  }

  pickerTargetId = objectId;
  pickerCurrentItems = backpackItemsOf(obj).slice();
  pickerSelectedItem = null;
  pickerSearch = '';
  pickerCategory = '';

  const modal = document.getElementById('itemPickerModal');
  const search = document.getElementById('pickerSearch');
  const category = document.getElementById('pickerCategory');
  const qtyInput = document.getElementById('pickerQty');
  if (!modal || !search || !category) return;

  if (qtyInput) qtyInput.value = '1';
  updatePickerConfirmText();

  search.value = '';
  fillCategoryTags(category, pickerCategory, (c) => {
    pickerCategory = c;
    renderPickerList();
  });
  if (window.bootstrap) {
    bootstrap.Modal.getOrCreateInstance(modal).show();
  } else {
    modal.style.display = 'flex';
  }
  renderPickerList();
  renderPickerDetail();
  search.focus();
}

function closeItemPicker() {
  const modal = document.getElementById('itemPickerModal');
  if (modal) {
    if (window.bootstrap) {
      bootstrap.Modal.getOrCreateInstance(modal).hide();
    } else {
      modal.style.display = 'none';
    }
  }
  pickerTargetId = null;
  pickerSelectedItem = null;
}

/** 确定：把弹框中选中的道具按弹框内数量添加到目标背包并关闭。 */
function confirmPickerAdd() {
  if (!pickerTargetId || !pickerSelectedItem) {
    showToast('请先选择道具');
    return;
  }

  const n = readPickerQty();

  // 库存预检：场景中有同名道具对象时按总库存校验数量
  const stock = itemNameStock(pickerSelectedItem);
  if (stock > 0) {
    const remaining = stock - heldItemCount(pickerSelectedItem);
    if (remaining <= 0) {
      showToast('该道具库存已分完，不可添加');
      return;
    }
    if (n > remaining) {
      showToast('库存不足，最多还可添加 ' + remaining + ' 个');
      return;
    }
  }

  const added = [];
  for (let i = 0; i < n; i++) added.push(pickerSelectedItem);
  send({
    type: 'gm_set_object_items',
    objectId: pickerTargetId,
    items: pickerCurrentItems.concat(added),
  });
  closeItemPicker();
}

/** 弹框道具列表：点击行选中并预览属性；库存已分完的行禁用。 */
function renderPickerList() {
  const container = document.getElementById('pickerList');
  if (!container) return;
  container.innerHTML = '';
  if (!pickerTargetId) return;

  const query = pickerSearch.trim().toLowerCase();
  const filtered = itemCatalog.filter((it) => {
    if (pickerCategory && (it.category || '—') !== pickerCategory) return false;
    if (!query) return true;
    return (it.name || '').toLowerCase().includes(query) || (it.category || '').toLowerCase().includes(query);
  });

  if (filtered.length === 0) {
    container.innerHTML = '<div class="property-empty">无匹配道具</div>';
    return;
  }

  for (const item of filtered) {
    const addable = canAddItem(item.name);
    const selected = item.name === pickerSelectedItem;
    const row = document.createElement('button');
    row.className = 'item-row' + (addable ? '' : ' disabled') + (selected ? ' selected' : '');
    row.disabled = !addable;
    row.title = addable ? (selected ? '已选中' : '点击查看属性') : '库存已分完，不可添加';
    row.onclick = () => {
      if (!addable) return;
      pickerSelectedItem = item.name;
      renderPickerList();
      renderPickerDetail();
    };

    const nameEl = document.createElement('span');
    nameEl.className = 'item-row-name';
    nameEl.textContent = item.name;

    const priceEl = document.createElement('span');
    priceEl.className = 'item-row-price';
    priceEl.textContent = item.price != null ? '$' + fmtPrice(item.price) : '价格自定';

    row.appendChild(nameEl);
    row.appendChild(priceEl);
    container.appendChild(row);
  }
}

/** 弹框右列：选中道具的属性预览 + 数量输入（数量行在底部，选中道具时显示）。 */
function renderPickerDetail() {
  const container = document.getElementById('pickerDetail');
  const title = document.getElementById('pickerDetailTitle');
  const confirmBtn = document.getElementById('pickerConfirm');
  const qtyRow = document.getElementById('pickerQtyRow');
  const qtyInput = document.getElementById('pickerQty');
  if (!container || !title) return;

  const item = itemCatalog.find((it) => it.name === pickerSelectedItem);
  if (!item) {
    title.textContent = '道具属性';
    container.innerHTML = '<div class="property-empty">点击左侧道具查看属性</div>';
    if (qtyRow) qtyRow.style.display = 'none';
  } else {
    title.textContent = item.name;
    container.innerHTML = '';
    const info = propertySection(container, '基本信息');
    addPropertyRow(info, '类别', item.category || '—');
    addPropertyRow(info, '价格', item.price != null ? '$' + fmtPrice(item.price) : '价格自定');
    addPropertyRow(info, '鉴定', item.identify || '—');
    addPropertyRow(info, '模组用途', item.usage || '—');

    // 选中道具后显示数量行（重新选择道具时数量复位为 1）
    if (qtyRow) qtyRow.style.display = 'flex';
    if (qtyInput) qtyInput.value = '1';
    updatePickerConfirmText();
  }

  if (confirmBtn) {
    confirmBtn.disabled = !pickerSelectedItem; // 未选中道具时确定按钮不可用
  }
}

// 道具搜索框与数量输入（只绑定一次）
(function initPickerFilters() {
  const search = document.getElementById('pickerSearch');
  if (search) {
    search.addEventListener('input', () => {
      pickerSearch = search.value;
      renderPickerList();
    });
  }
  const qty = document.getElementById('pickerQty');
  if (qty) {
    qty.addEventListener('input', () => {
      qty.value = String(readPickerQty()); // 夹取到 1~99
      updatePickerConfirmText(); // 确定按钮显示 ×N
    });
  }
})();
// 道具搜索框（只绑定一次，避免每次重渲染时重复监听）
(function initItemFilters() {
  const input = document.getElementById('itemSearch');
  if (input) {
    input.addEventListener('input', () => {
      itemSearch = input.value;
      renderItemList();
    });
  }
})();
