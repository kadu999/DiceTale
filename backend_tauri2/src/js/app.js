// ---------- GM 控制台：启动（加载地图列表 + 布局监听 + 建立连接） ----------

// 加载时获取服务器可提供的地图列表（浏览所有地图）
backendFetchJson('/api/maps')
  .then((data) => {
    apiMaps = (data && data.maps) || [];
    if (state) render();
  })
  .catch(() => {});

window.addEventListener('resize', fitLayout);
window.addEventListener('orientationchange', function () {
  setTimeout(fitLayout, 300);
});
setTimeout(fitLayout, 300);

connect();
