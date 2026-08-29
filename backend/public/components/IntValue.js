// 组件渲染器：IntValue（整数参数）——与客户端组件类同名，属性面板按 componentData 调用。
// 控件：整数输入框，值变化发 gm_set_int。container 是已带分区标题（组件显示名）的 section。
function renderIntValue(container, objectId, obj) {
  const row = document.createElement('div');
  row.className = 'property-row';
  const label = document.createElement('span');
  label.className = 'property-label';
  label.textContent = '值';
  const input = document.createElement('input');
  input.type = 'number';
  input.step = '1';
  input.className = 'property-item-qty';
  input.value = String((componentParams(obj, 'IntValue') || {}).value ?? 0);
  input.addEventListener('change', () => {
    const v = parseInt(input.value, 10);
    if (Number.isNaN(v)) return;
    send({ type: 'gm_set_int', objectId, value: v });
  });
  row.appendChild(label);
  row.appendChild(input);
  container.appendChild(row);
}
