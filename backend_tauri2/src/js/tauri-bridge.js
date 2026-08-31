// Tauri 桥接：检测是否运行在 Tauri 壳（PC/Android）内。
// 壳内页面源为 tauri://localhost，直接 fetch 后端 HTTP 会被 CORS 拦截，
// 这里改用 Tauri 原生 command（http_get_json / http_get）转发，绕过浏览器 CORS。
// 浏览器（网页端）环境检测不到 Tauri，保持原生 fetch。

function isTauri() {
  return typeof window !== 'undefined' &&
    (!!window.__TAURI_INTERNALS__ || !!window.__TAURI__);
}

/** 跨环境 GET：返回解析后的 JSON（items.json / api/maps 等）。 */
async function backendFetchJson(path) {
  const url = backendUrl(path);
  if (isTauri()) {
    const res = await window.__TAURI_INTERNALS__.invoke('http_get_json', { url });
    return res; // serde_json::Value -> JS 对象
  }
  const resp = await fetch(url);
  return resp.json();
}

/** 跨环境 GET 文本（备用）。 */
async function backendFetchText(path) {
  const url = backendUrl(path);
  if (isTauri()) {
    const bytes = await window.__TAURI_INTERNALS__.invoke('http_get', { url });
    // bytes 是数字数组
    return bytes.map((b) => String.fromCharCode(b)).join('');
  }
  const resp = await fetch(url);
  return resp.text();
}
