// ---------- 属性列表（右侧） ----------

/** 刷新地图页右侧属性面板。 */
function renderPropertyPanel() {
  renderPropertyPanelInto('propertyListMap');
}
/** 组件 → 属性面板控件渲染器（与客户端组件类同名；新增客户端组件时在此注册渲染器）。 */
const componentRenderers = {
  StateMachine: (container, objectId, obj) =>
    renderObjectStates(propertySection(container, '状态'), objectId, obj, null),
  Backpack: (container, objectId, obj) =>
    renderObjectItems(propertySection(container), objectId, (obj && obj.items) || [], '物品'),
  ItemExchange: (container, objectId, obj) =>
    renderItemDistribution(propertySection(container), obj),
  Mask: (container, objectId) =>
    renderMaskControl(propertySection(container, '遮罩'), objectId),
};

function inferComponents(obj) {
  const list = [];
  if (!obj) return list;
  if ((obj.states || []).length > 0) list.push('StateMachine');
  if (obj.maskWidth > 0 && obj.maskHeight > 0) list.push('Mask');
  if (obj.itemName) list.push('ItemExchange');
  else if ((obj.items || []).length > 0) list.push('Backpack');
  return list;
}

function renderPropertyPanelInto(id) {
  const container = document.getElementById(id);
  if (!container) return;
  container.innerHTML = '';

  if (!selectedObjectId) {
    container.innerHTML = '<div class="property-empty">请在地图上点击目标，查看并修改其属性</div>';
    return;
  }

  const obj = (state.objects && state.objects[selectedObjectId]) || null;
  const player = (state.players && state.players[selectedObjectId]) || null;
  if (!obj && !player) {
    container.innerHTML = '<div class="property-empty">未找到该目标（可能已移除）</div>';
    return;
  }

  // 基本信息（玩家在 objects 中缺条目时用 players 名单兜底）
  const info = propertySection(container, '基本信息');
  addPropertyRow(info, '名称', (obj && obj.name) || (player && player.name) || selectedObjectId);
  addPropertyRow(info, 'ID', selectedObjectId);
  addPropertyRow(info, '位置', fmtPos((obj && obj.position) || (player && player.position)));
  if (player) addPropertyRow(info, '地图', player.mapName || '-');

  // 按组件清单渲染属性控件（与客户端组件类同名：状态=单选组、物品=编辑、道具=分配、遮罩=修改弹框）
  const components = (obj && obj.components && obj.components.length > 0)
    ? obj.components
    : inferComponents(obj);
  for (const comp of components) {
    const renderer = componentRenderers[comp];
    if (renderer) {
      renderer(container, selectedObjectId, obj);
    } else {
      renderUnknownComponent(container, comp);
    }
  }
}
function renderUnknownComponent(container, comp) {
  const section = propertySection(container);
  const row = document.createElement('div');
  row.className = 'property-row';
  const label = document.createElement('span');
  label.className = 'property-label';
  label.textContent = '组件';
  const val = document.createElement('span');
  val.className = 'property-value';
  val.textContent = comp + '（客户端已上报，后台暂未支持）';
  row.appendChild(label);
  row.appendChild(val);
  section.appendChild(row);
}
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
