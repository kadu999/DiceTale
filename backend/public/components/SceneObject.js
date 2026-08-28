function renderObjectStates(container, objectId, obj, labelText) {
  const states = (obj && obj.states) || [];
  if (states.length === 0) {
    return; // 未配置状态列表：整个「切换状态」区都不显示
  }

  const statesRow = document.createElement('div');
  statesRow.className = 'property-row';
  if (labelText) {
    const label = document.createElement('span');
    label.className = 'property-label';
    label.textContent = labelText;
    statesRow.appendChild(label);
  }
  const statesBox = document.createElement('div');
  statesBox.className = 'property-states';

  for (const stateName of states) {
    const btn = document.createElement('button');
    btn.className = 'state-btn' + (stateName === obj.currentState ? ' active' : '');
    btn.textContent = stateName;
    btn.onclick = () => {
      send({ type: 'gm_set_object_state', objectId, state: stateName });
    };
    statesBox.appendChild(btn);
  }

  statesRow.appendChild(statesBox);
  container.appendChild(statesRow);
}
