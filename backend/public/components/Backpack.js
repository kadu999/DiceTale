// 组件渲染器：Backpack（背包）——与客户端组件类同名，属性面板按 components 清单调用。
// 控件：道具列表编辑（添加/移除，走 gm_set_object_items）。
function renderObjectItems(container, objectId, items, labelText) {
  // 行 1：属性面板 UI 规则——左侧名字，右侧功能控件（添加道具按钮，数量在弹框内填写）
  const row = document.createElement('div');
  row.className = 'property-row';
  if (labelText) {
    const label = document.createElement('span');
    label.className = 'property-label';
    label.textContent = labelText;
    row.appendChild(label);
  }

  const addBtn = document.createElement('button');
  addBtn.className = 'state-btn property-item-add-btn';
  addBtn.textContent = '添加道具';
  addBtn.title = '从道具目录中选择并添加到背包';
  addBtn.onclick = () => openItemPicker(objectId);
  row.appendChild(addBtn);

  // 行 2：携带的道具列表（分配样式：[-] 道具名 数量 [+]，走 gm_set_object_items）
  const box = document.createElement('div');
  box.className = 'property-items';

  // 按道具名分组统计数量：['铁剑','铁剑','草药'] → 铁剑 ×2、草药 ×1
  const counts = {};
  for (const item of items) {
    counts[item] = (counts[item] || 0) + 1;
  }
  const grouped = Object.entries(counts);

  if (grouped.length === 0) {
    const empty = document.createElement('span');
    empty.className = 'property-hint';
    empty.textContent = '暂无物品';
    box.appendChild(empty);
  } else {
    for (const [name, count] of grouped) {
      const line = document.createElement('div');
      line.className = 'property-distribute-line';

      const minus = document.createElement('button');
      minus.className = 'state-btn';
      minus.title = '移除一个';
      minus.textContent = '−';
      minus.onclick = () => {
        const next = items.slice();
        const idx = next.indexOf(name);
        if (idx >= 0) next.splice(idx, 1); // 每次只移除一个该道具
        send({ type: 'gm_set_object_items', objectId, items: next });
      };

      const nameEl = document.createElement('span');
      nameEl.className = 'property-distribute-name';
      nameEl.textContent = name;

      const countEl = document.createElement('span');
      countEl.className = 'property-distribute-count';
      countEl.textContent = count;

      const plus = document.createElement('button');
      plus.className = 'state-btn property-distribute-plus';
      plus.title = '添加一个';
      plus.textContent = '+';
      plus.disabled = !canAddItem(name); // 库存已分完时不可再添加
      plus.onclick = () => {
        send({ type: 'gm_set_object_items', objectId, items: items.concat([name]) });
      };

      line.appendChild(minus);
      line.appendChild(nameEl);
      line.appendChild(countEl);
      line.appendChild(plus);
      box.appendChild(line);
    }
  }

  container.appendChild(row);
  container.appendChild(box);
}
