// Tauri 桥接：检测是否运行在 Tauri 壳（PC/Android）内。
// 壳内页面源为 tauri://localhost，直接 fetch 后端 HTTP 会被 CORS 拦截，
// 这里改用 Tauri 原生 command（http_get_json / http_get）转发，绕过浏览器 CORS。
// 浏览器（网页端）环境检测不到 Tauri，保持原生 fetch。
// 用 window.x = window.x || ... 防御式声明：即使本文件被重复加载也不会报重复声明。
//
// 注意：检测函数不能命名为 isTauri —— Tauri 自身会往 window 注入 isTauri = true（布尔值），
// 注入时机在页面脚本之后，会把我们定义的函数覆盖掉，导致 isTauri() 调用抛
// "isTauri is not a function"，地图列表 / 道具目录等经 http_get_json 拉取的数据全部失败
// （WS 不受影响，所以只剩 state 里的当前地图，道具列表为空）。
// 因此这里用独立命名 isDiceTaleTauri，避免与 Tauri 注入的全局变量冲突。

if (typeof window.isDiceTaleTauri !== 'function') {
  window.isDiceTaleTauri = function () {
    return typeof window !== 'undefined' &&
      (!!window.__TAURI_INTERNALS__ || !!window.__TAURI__);
  };
}

/** 跨环境 GET：返回解析后的 JSON（items.json / api/maps 等）。 */
if (typeof window.backendFetchJson !== 'function') {
  window.backendFetchJson = async function (path) {
    const url = backendUrl(path);
    if (window.isDiceTaleTauri()) {
      const res = await window.__TAURI_INTERNALS__.invoke('http_get_json', { url });
      return res; // serde_json::Value -> JS 对象
    }
    const resp = await fetch(url);
    return resp.json();
  };
}

/** 跨环境 GET 文本（备用）。 */
if (typeof window.backendFetchText !== 'function') {
  window.backendFetchText = async function (path) {
    const url = backendUrl(path);
    if (window.isDiceTaleTauri()) {
      const bytes = await window.__TAURI_INTERNALS__.invoke('http_get', { url });
      // bytes 是数字数组
      return bytes.map((b) => String.fromCharCode(b)).join('');
    }
    const resp = await fetch(url);
    return resp.text();
  };
}
