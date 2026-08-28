function renderMaskControl(container, objectId) {
  const maskSection = propertySection(container, '遮罩');
  const maskRow = document.createElement('div');
  maskRow.className = 'property-row';
  const maskLabel = document.createElement('span');
  maskLabel.className = 'property-label';
  maskLabel.textContent = '遮罩';
  maskRow.appendChild(maskLabel);
  const editBtn = document.createElement('button');
  editBtn.className = 'state-btn property-item-add-btn';
  editBtn.textContent = '修改';
  editBtn.title = '打开遮罩编辑弹框，用鼠标擦除黑色遮罩';
  editBtn.onclick = () => openMaskEditor(objectId);
  maskRow.appendChild(editBtn);
  maskSection.appendChild(maskRow);
}
