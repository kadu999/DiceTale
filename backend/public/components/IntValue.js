// 组件渲染器：IntValue（整数参数）——与客户端组件类同名，属性面板按 componentData 调用。
// 控件由组件参数控制：enableRange 关闭 = 仅数字输入框；启用 = 数字输入框 + 滑动条（范围取 min/max）。
// 数字框 change 或滑条释放（change）时发送 gm_set_int；滑条拖动中（input）只实时同步数字框。
function renderIntValue(container, objectId, obj) {
  const params = componentParams(obj, 'IntValue') || {};
  const value = params.value ?? 0;
  const hasRange = params.enableRange === true && (params.min ?? 0) < (params.max ?? 100);

  const row = document.createElement('div');
  row.className = 'property-row';
  const label = document.createElement('span');
  label.className = 'property-label';
  label.textContent = '值';

  const input = document.createElement('input');
  input.type = 'number';
  input.step = '1';
  if (hasRange) {
    input.min = String(params.min);
    input.max = String(params.max);
  }
  input.className = 'property-item-qty';
  input.value = String(value);

  let slider = null;
  const apply = (v) => {
    const n = parseInt(v, 10);
    if (Number.isNaN(n)) return;
    input.value = String(n);
    if (slider) slider.value = String(n);
    send({ type: 'gm_set_int', objectId, value: n });
  };

  input.addEventListener('change', () => apply(input.value));

  // 滑动条：只有启用范围（enableRange）且 min < max 才渲染
  if (hasRange) {
    slider = document.createElement('input');
    slider.type = 'range';
    slider.min = String(params.min);
    slider.max = String(params.max);
    slider.step = '1';
    slider.className = 'property-item-slider';
    slider.value = String(value);
    slider.addEventListener('input', () => { input.value = slider.value; }); // 拖动实时同步数字框
    slider.addEventListener('change', () => apply(slider.value));            // 释放时发送
    row.appendChild(slider);
  }

  row.appendChild(label);
  row.appendChild(input);
  container.appendChild(row);
}
