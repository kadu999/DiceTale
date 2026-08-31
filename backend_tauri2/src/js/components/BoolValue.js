// 组件渲染器：BoolValue（布尔参数）——与客户端组件类同名，属性面板按 componentData 调用。
// 控件：开关（勾选），切换发 gm_set_bool。container 是已带分区标题（组件显示名）的 section。
function renderBoolValue(container, objectId, obj) {
  const row = document.createElement('div');
  row.className = 'property-row';
  const label = document.createElement('span');
  label.className = 'property-label';
  label.textContent = '值';
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.checked = !!(componentParams(obj, 'BoolValue') || {}).value;
  input.addEventListener('change', () => {
    send({ type: 'gm_set_bool', objectId, value: input.checked });
  });
  row.appendChild(label);
  row.appendChild(input);
  container.appendChild(row);
}
