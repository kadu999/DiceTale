// 组件渲染器：OptionValue（选项值）——与客户端组件类同名，属性面板按 componentData 调用。
// 控件：选项单选组（点击发 gm_set_option，客户端枢纽路由到 OptionValue.TrySetState）。
function renderOptionValue(container, objectId, obj, labelText) {
  const params = componentParams(obj, 'OptionValue') || {};
  const options = params.options || [];
  if (options.length === 0) {
    return; // 未配置选项列表：整个「切换选项」区都不显示
  }

  const optionsRow = document.createElement('div');
  optionsRow.className = 'property-row';
  if (labelText) {
    const label = document.createElement('span');
    label.className = 'property-label';
    label.textContent = labelText;
    optionsRow.appendChild(label);
  }
  const optionsBox = document.createElement('div');
  optionsBox.className = 'property-states';

  for (const optionName of options) {
    const btn = document.createElement('button');
    btn.className = 'state-btn' + (optionName === params.currentOption ? ' active' : '');
    btn.textContent = optionName;
    btn.onclick = () => {
      send({ type: 'gm_set_option', objectId, option: optionName });
    };
    optionsBox.appendChild(btn);
  }

  optionsRow.appendChild(optionsBox);
  container.appendChild(optionsRow);
}
