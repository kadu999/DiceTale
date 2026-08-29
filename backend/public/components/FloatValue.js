// 组件渲染器：FloatValue（浮点参数）——与客户端组件类同名，属性面板按 components 清单调用。
// 控件：数字输入框（可小数），值变化发 gm_set_float。
function renderFloatValue(container, objectId, obj) {
  const section = propertySection(container, '浮点参数');
  const row = document.createElement('div');
  row.className = 'property-row';
  const label = document.createElement('span');
  label.className = 'property-label';
  label.textContent = '值';
  const input = document.createElement('input');
  input.type = 'number';
  input.step = 'any';
  input.className = 'property-item-qty';
  input.value = String((componentParams(obj, 'FloatValue') || {}).value ?? 0);
  input.addEventListener('change', () => {
    const v = parseFloat(input.value);
    if (Number.isNaN(v)) return;
    send({ type: 'gm_set_float', objectId, value: v });
  });
  row.appendChild(label);
  row.appendChild(input);
  section.appendChild(row);
}
