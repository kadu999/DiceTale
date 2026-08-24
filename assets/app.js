document.addEventListener('DOMContentLoaded', () => {
  const rollBtn = document.getElementById('rollBtn');
  const rollResult = document.getElementById('rollResult');

  rollBtn.addEventListener('click', () => {
    const value = Math.floor(Math.random() * 100) + 1;
    rollResult.textContent = `d100 = ${value}`;
  });
});
