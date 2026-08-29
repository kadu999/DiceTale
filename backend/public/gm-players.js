/** 渲染玩家页：每个玩家一个属性卡片，从左到右排列。 */
function renderPlayerList() {
  const container = document.getElementById('playerList');
  if (!container) return;
  container.innerHTML = '';

  const players = Object.entries(state.players || {});
  if (players.length === 0) {
    container.innerHTML = '<div class="player-empty">暂无玩家</div>';
    return;
  }

  for (const [playerId, player] of players) {
    const card = document.createElement('div');
    card.className = 'player-card' + (playerId === selectedObjectId ? ' selected' : '');
    card.onclick = (e) => {
      // 卡片内的输入框/按钮操作不触发选中（避免输入框失焦）
      if (e.target.closest('input, button')) return;
      selectObject(playerId);
    };

    // 标题：玩家名居中（与地图页属性面板一致）
    const title = document.createElement('div');
    title.className = 'property-title';
    title.textContent = player.name || playerId;
    card.appendChild(title);

    // 内容区：与属性面板同款，超高时面板内滚动
    const list = document.createElement('div');
    list.className = 'property-list';
    card.appendChild(list);

    // 基本信息
    const info = propertySection(list, '基本信息');
    addPropertyRow(info, 'ID', playerId);
    addPropertyRow(info, '地图', player.mapName || '-');
    addPropertyRow(info, '位置', fmtPos(player.position));

    // 状态操作优先：放在物品区之前（未配置状态列表时不显示）；分区标题用组件显示名
    const obj = state.objects && state.objects[playerId];
    const smBlock = componentBlock(obj, 'StateMachine');
    const smParams = componentParams(obj, 'StateMachine') || {};
    if ((smParams.states || []).length > 0) {
      renderObjectStates(propertySection(list, (smBlock && smBlock.displayName) || '状态'), playerId, obj, null);
    }

    // 物品编辑（与地图页属性面板一致的物品区，section 包裹以带分隔线；标题用组件显示名）
    const bpBlock = componentBlock(obj, 'Backpack');
    renderObjectItems(propertySection(list, (bpBlock && bpBlock.displayName) || '物品'), playerId, backpackItemsOf(obj));

    container.appendChild(card);
  }
}
