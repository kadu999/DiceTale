// DiceTale GM 后端地址配置（写死于本文件，前端没有设置界面）。
//  - DICETALE_BACKEND_URL 有值：强制使用该地址（优先级最高，一般留空 ''）
//  - DICETALE_BACKEND_ANDROID：Tauri 壳 Android 端使用的后端地址。手机连电脑必须填电脑局域网 IP
//    （如 http://192.168.1.33:1420），因为手机自身的 localhost 指向手机自己；换网络/换电脑时需同步修改。
//  - DICETALE_BACKEND_FALLBACK：Tauri 壳 PC / 1421 预览页等非后端同源环境使用的地址。
//    默认 http://localhost:1420，与 server/config.json 的 port 一致；后端端口改动时需同步修改。
//  - 网页版由后端托管时自动同源，无需配置。
window.DICETALE_BACKEND_URL = '';
window.DICETALE_BACKEND_ANDROID = 'http://192.168.1.33:1420';
window.DICETALE_BACKEND_FALLBACK = 'http://localhost:1420';
