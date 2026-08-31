// ---------- GM 控制台：启动（加载地图列表 + 布局监听 + 建立连接） ----------
// 后端地址由 config.js 写死（window.DICETALE_BACKEND_URL），前端无设置界面。

// 加载时获取服务器可提供的地图列表（浏览所有地图）；连接建立后还会自动补拉一次
refreshBackendData();

window.addEventListener('resize', fitLayout);
window.addEventListener('orientationchange', function () {
  setTimeout(fitLayout, 300);
});
setTimeout(fitLayout, 300);

connect();
