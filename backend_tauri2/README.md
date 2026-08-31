# backend_tauri2 — DiceTale GM 控制台（网页 / PC / Android 三端）

Unity 客户端（单客户端）配套的 GM 控制台与中继后台：TypeScript 后台（`server/`）+ 静态前端（`src/`）+ Tauri 2 壳（`src-tauri/`）。

## 架构

- **后台**（`server/src/index.ts`，Node + ws）：单端口托管前端页面、`/api/maps`、`/maps/*.png`、`/items.json` 与 WebSocket（`/client` 接 Unity 客户端、`/gm` 接 GM 控制台）。
- **前端**（`src/`）：GM 控制台网页，可被后台同源托管、`serve.js` 预览页（1421）或 Tauri 壳（PC/Android）加载。
- **Tauri 壳**（`src-tauri/`）：Rust 侧只做一件事——`http_get` / `http_get_json` 命令，绕过壳内页面跨域限制访问后端。

## 配置（全部收敛到配置文件）

### 1. `server/config.json`（后台）

| 键 | 默认 | 说明 |
| --- | --- | --- |
| `port` | `1420` | 后台监听端口（HTTP + WS） |
| `mapsDir` | `maps` | 地图贴图目录（相对 `server/` 或绝对路径） |
| `debugWs` | `false` | 打印每次 WS 升级请求的调试日志（排查手机端握手失败） |
| `maxMessageMb` | `16` | 单条 WS 消息大小上限（MB），遮罩图等大消息的上限 |

环境变量优先级更高：`PORT`、`MAPS_DIR`、`DEBUG_WS`（`1`/`true`）、`MAX_MESSAGE_MB`，`DICETALE_CONFIG` 可指定其它配置文件路径。

> 注意：`src/config.js` 的 `DICETALE_BACKEND_FALLBACK` 默认值与 `port` 保持一致（`http://localhost:1420`），**改动端口时需同步修改**。

### 2. `src/config.js`（前端后端地址）

| 键 | 默认 | 说明 |
| --- | --- | --- |
| `DICETALE_BACKEND_URL` | `''` | 强制指定后端地址（优先级最高，一般留空） |
| `DICETALE_BACKEND_ANDROID` | `http://192.168.1.33:1420` | Tauri 壳 Android 端使用的后端地址：**手机连电脑必须填电脑局域网 IP**（手机自身 localhost 指向手机自己），换网络/换电脑时需同步修改 |
| `DICETALE_BACKEND_FALLBACK` | `http://localhost:1420` | 非后端同源环境（Tauri 壳 PC、1421 预览页）使用的后端地址 |

地址确定优先级：`DICETALE_BACKEND_URL` 有值 → 强制使用；Tauri 壳 Android 端 → `DICETALE_BACKEND_ANDROID`；页面由后端同源托管 → 同源；否则 → `DICETALE_BACKEND_FALLBACK`。

### 3. 其它配置

- 地图贴图 `*.png` 放 `server/maps/`（后台自持副本，不读 Unity 客户端目录）。
- 道具目录唯一来源是 `src/items.json`（由 `tools/convert_items.py` 从 xlsx 生成），后台直接托管该文件，无需同步。

## 启动

```bat
serve-web.bat        :: 单端口：后台 + 网页，浏览器打开 http://localhost:1420/
dev-pc.bat           :: Tauri PC 开发模式（热更新，页面在 1421，后端自动拉起）
dev-android.bat      :: Tauri Android 开发模式（模拟器/真机）
build-pc.bat         :: 打包 PC 安装包（msi / nsis）
build-android.bat    :: 打包 Android APK
install-apk.bat      :: 安装 APK 到已连接设备（可选参数：apk 路径）
open-port.bat        :: 放行防火墙 TCP 端口（局域网设备访问需管理员，自动提权）
```

等价 npm 脚本：`npm run serve`（后台）、`npm run dev` / `npm run dev:android` / `npm run build` / `npm run build:android`。

## Android 构建说明

以下自定义均在 `src-tauri/gen/android/` 下，已**单独入库**（其余内容仍是生成物、不入库）；若重新执行
`tauri android init` 会覆盖，需用 `git checkout -- <对应文件>` 恢复。

- **横屏锁定**：`app/src/main/AndroidManifest.xml` 中 `.MainActivity` 的
  `android:screenOrientation="landscape"`（Tauri 暂未提供 orientation 配置项，见 tauri-apps/tauri#13408）。
- **安全区（刘海/挖孔 + 虚拟按键）**：Tauri 模板默认 `enableEdgeToEdge()` 会让 WebView 画到系统栏下面，
  横屏时右侧被虚拟按键遮挡；`app/src/main/java/com/dicetale/gm/MainActivity.kt` 已去掉该调用，
  主题 `app/src/main/res/values*/themes.xml` 增加 `windowLayoutInDisplayCutoutMode=never`
  （左侧摄像头挖孔不遮挡）与 `windowOptOutEdgeToEdgeEnforcement=true`（Android 15+ 强制 edge-to-edge 时保持退出）。
  注：Android 9 WebView 不报告 `env(safe-area-inset-*)`，故不能靠前端 CSS 解决，必须走原生层。

## 通信协议

所有消息为 JSON 走 WebSocket。协议类型定义见 `server/src/types.ts`；数据流为客户端主导（客户端上报地图/物体/玩家状态，后台展示；GM 操作由后台转发命令给客户端，客户端不回执，后台快照为准）。
