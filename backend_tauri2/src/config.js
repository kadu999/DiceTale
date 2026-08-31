// DiceTale GM 后端地址配置（写死于本文件，前端没有设置界面）。
//  - DICETALE_BACKEND_URL 有值：强制使用该地址（手机连电脑请填电脑局域网 IP，如 http://192.168.1.33:1420）
//  - 留空 ''：自动——网页版由后端托管时同源；Tauri 壳 PC / 1421 预览页等非后端同源环境使用 DICETALE_BACKEND_FALLBACK
//  - DICETALE_BACKEND_FALLBACK：非后端同源环境（Tauri 壳、serve.js 预览页）使用的后端地址；
//    默认 http://localhost:1420，与 server/config.json 的 port 一致；后端端口改动时需同步修改这里。
window.DICETALE_BACKEND_URL = '';
window.DICETALE_BACKEND_FALLBACK = 'http://localhost:1420';
