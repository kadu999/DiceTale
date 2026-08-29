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
    renderObjectItems(propertySection(container), objectId, (componentParams(obj, 'Backpack') || {}).items || [], '物品'),
  ItemExchange: (container, objectId, obj) =>
    renderItemDistribution(propertySection(container), obj),
  Mask: (container, objectId) =>
    renderMaskControl(propertySection(container, '遮罩'), objectId),
  FloatValue: (container, objectId, obj) =>
    renderFloatValue(container, objectId, obj),
  IntValue: (container, objectId, obj) =>
    renderIntValue(container, objectId, obj),
  BoolValue: (container, objectId, obj) =>
    renderBoolValue(container, objectId, obj),
};

/** 取对象某组件的数据段（componentData 中按组件类型找；无则 null）。 */
function componentBlock(obj, component) {
  return ((obj && obj.componentData) || []).find((c) => c.component === component) || null;
}

/** 解析对象某组件的 JSON 数据（无组件或解析失败返回 null）。 */
function componentParams(obj, component) {
  const block = componentBlock(obj, component);
  if (!block || !block.data) return null;
  try {
    return JSON.parse(block.data);
  } catch (e) {
    return null;
  }
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

  // 按组件数据段渲染属性控件（component = 组件类型，data = JSON 字符串，各渲染器自己解析）
  const data = (obj && obj.componentData) || [];
  for (const block of data) {
    const renderer = componentRenderers[block.component];
    if (renderer) {
      renderer(container, selectedObjectId, obj);
    } else {
      renderUnknownComponent(container, block.component);
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
