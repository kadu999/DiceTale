// 组件渲染器：ItemExchange（道具交换）——与客户端组件类同名，属性面板按 components 清单调用。
// 控件：道具分配列表（剩余数量 + 每玩家 −/+，走 gm_set_object_items）。
function itemRemaining(obj) {
  if (!obj || !obj.itemName) return null;
  const total = obj.quantity || 0;
  let held = 0;
  for (const playerId of Object.keys(state.players || {})) {
    const items = (state.objects[playerId] && state.objects[playerId].items) || [];
    for (const it of items) {
      if (it === obj.itemName) held++;
    }
  }
  return Math.max(0, total - held);
}

function renderItemDistribution(container, obj) {
  const itemName = obj.itemName;
  const remaining = itemRemaining(obj);

  // 标题单独一行
  const title = document.createElement('div');
  title.className = 'property-distribute-title';
  title.textContent = remaining != null ? `分配道具（剩余 ${remaining}）` : '分配道具';
  container.appendChild(title);

  if (!itemName) {
    const hint = document.createElement('div');
    hint.className = 'property-hint';
    hint.textContent = '道具未配置名称（在客户端 Inspector 的 Item Name 里填写）';
    container.appendChild(hint);
    return;
  }

  const players = Object.entries(state.players || {});
  if (players.length === 0) {
    const hint = document.createElement('div');
    hint.className = 'property-hint';
    hint.textContent = '暂无玩家';
    container.appendChild(hint);
    return;
  }

  for (const [playerId, player] of players) {
    const playerItems = (state.objects[playerId] && state.objects[playerId].items) || [];
    const count = playerItems.filter((i) => i === itemName).length;

    const line = document.createElement('div');
    line.className = 'property-distribute-line';

    const minus = document.createElement('button');
    minus.className = 'state-btn';
    minus.title = '收回一个';
    minus.textContent = '−';
    minus.onclick = () => {
      const next = playerItems.slice();
      const idx = next.indexOf(itemName);
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
    plus.disabled = remaining != null && remaining <= 0; // 库存不足不可分配
    plus.onclick = () => {
      send({ type: 'gm_set_object_items', objectId: playerId, items: playerItems.concat([itemName]) });
    };

    line.appendChild(minus);
    line.appendChild(nameEl);
    line.appendChild(countEl);
    line.appendChild(plus);
    container.appendChild(line);
  }
}
