#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![http_get, http_get_json])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}

/// 简单 HTTP GET 转发（返回文本/二进制）：Tauri 壳（PC/Android）里前端 fetch 跨域受限，
/// 通过原生侧发起请求绕过 CORS。浏览器环境仍用原生 fetch，这里只在 Tauri 环境调用。
#[tauri::command]
fn http_get(url: String) -> Result<Vec<u8>, String> {
  let resp = ureq::get(&url)
    .timeout(std::time::Duration::from_secs(10))
    .call()
    .map_err(|e| format!("request failed: {e}"))?;
  let mut bytes = Vec::new();
  use std::io::Read;
  resp.into_reader()
    .take(8 * 1024 * 1024) // 8MB 上限
    .read_to_end(&mut bytes)
    .map_err(|e| format!("read failed: {e}"))?;
  Ok(bytes)
}

/// 文本型 GET（items.json / api/maps），自动按 UTF-8 解码。
#[tauri::command]
fn http_get_json(url: String) -> Result<serde_json::Value, String> {
  let bytes = http_get(url)?;
  let text = String::from_utf8(bytes).map_err(|e| format!("not utf-8: {e}"))?;
  serde_json::from_str(&text).map_err(|e| format!("bad json: {e}"))
}
