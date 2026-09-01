# backend_tauri2 — DiceTale GM 控制台（网页 / Android，PC 用浏览器）

Unity 客户端（单客户端）配套的 GM 控制台与中继后台：TypeScript 后台（`server/`）+ 静态前端（`src/`）+ Tauri 2 Android 壳（`src-tauri/`）。

## 架构

- **后台**（`server/src/index.ts`，Node + ws）：单端口托管前端页面、`/api/maps`、`/maps/*.png`、`/items.json` 与 WebSocket（`/client` 接 Unity 客户端、`/gm` 接 GM 控制台）。前端页面与后端**同源**，无跨域问题。
- **前端**（`src/`）：GM 控制台网页，永远由后端同源托管（`http://<后端>:1420/`）。
  - PC：运行 `serve-web.bat`，浏览器打开 `http://localhost:1420/` 即完整控制台；
  - Android：Tauri 壳引导页跳转到电脑局域网地址（`http://<电脑IP>:1420`），渲染的是同一份页面。
- **Tauri 壳**（`src-tauri/`）：只做一件事——提供一个窗口。内嵌的只有 `bootstrap/index.html` 引导页（填后端地址 → 跳转并记住），**不内嵌 GM 页面**，因此也没有 CORS 转发命令。

### 开发回路（为什么前端改动不用重打包）

GM 页面由后端托管、后端静态资源带 `Cache-Control: no-cache`，所以：

- 改前端代码 → PC 浏览器 F5 / Android 壳内点右上角"刷新"（或重开 App）→ **立即生效，零重打包**；
- 换电脑 / 换网络 → Android 壳内点引导页的"修改地址"（或清掉 App 数据），重新填电脑 IP 即可，**也不需要重打包**；
- 只有改 Rust / 壳本身（极少数情况）才需要重新 `build-android.bat`。

## 前端布局与自动验证（移动优先）

- **布局策略**：移动优先——默认（<576px，与 `index.html` 的 `col-sm-*` 断点一致）为单列堆叠、整页滚动、列表不设内层滚动；≥576px 为三栏面板、视口锁定、列表内层滚动。Android 壳锁横屏（如 828×378），横屏手机与 PC 一样走左→右三栏；竖屏手机（<576px）才是单列堆叠。全部收敛在 `css/gm.css`。
- **布局只由 CSS 负责**：`gm-core.js` 不再有 `fitMapContainer`/`syncPropertyHeight` 之类的 JS 布局计算（地图尺寸用纯 CSS：`aspect-ratio` + `dvh` 上限，旧 WebView 回退 `vh`）；JS 只做数据渲染与标记定位（`gm-map.js` 的 `mapImageRect` 按图片实际矩形算）。
- **触控目标**：关键交互元素最小高度 44px；窄屏导航栏自动换行；安全区用 `env(safe-area-inset-*)`（不支持的 WebView 自动回退）。
- **自动验证**：`npm run test:ui`（`scripts/ui-check.js`）——自动起后端，在视口矩阵（360×640 / 412×915 / 768×1024 / 1024×768 / 1440×900）上注入演示 state，逐页截图并断言：无横向溢出、导航栏不溢出、触控目标 ≥44px、桌面视口下 `main` 不整页滚动。截图与报告存 `ui-shots/`。浏览器优先用系统 Edge/Chrome，否则需先 `npx playwright install chromium`。
- 日常流程：改前端 → `npm run test:ui` 浏览器秒级验证 → 真机只做最终确认（App 内"刷新"即可，无需重打包）。

## 配置

### 1. `server/config.json`（后台）

| 键 | 默认 | 说明 |
| --- | --- | --- |
| `port` | `1420` | 后台监听端口（HTTP + WS），即前端页面地址的端口 |
| `mapsDir` | `maps` | 地图贴图目录（相对 `server/` 或绝对路径） |
| `debugWs` | `false` | 打印每次 WS 升级请求的调试日志（排查手机端握手失败） |
| `maxMessageMb` | `16` | 单条 WS 消息大小上限（MB），遮罩图等大消息的上限 |

环境变量优先级更高：`PORT`、`MAPS_DIR`、`DEBUG_WS`（`1`/`true`）、`MAX_MESSAGE_MB`，`DICETALE_CONFIG` 可指定其它配置文件路径。

> 前端地址 = 页面来源（`location.origin`），无需再单独配置；改端口只需改本文件的 `port`。

### 2. 其它配置

- 地图贴图 `*.png` 放 `server/maps/`（后台自持副本，不读 Unity 客户端目录）。
- 道具目录唯一来源是 `src/items.json`（由 `tools/convert_items.py` 从 xlsx 生成），后台直接托管该文件，无需同步。
- Android 壳首次连接的后端地址由引导页在手机上填写并保存在本机（`localStorage`），不在仓库里配置。

## 启动

```bat
serve-web.bat        :: PC 入口：单端口后台 + 网页，浏览器打开 http://localhost:1420/
dev-android.bat      :: 构建并安装 Android debug APK（壳，只需构建一次；前端迭代靠刷新）
build-android.bat    :: 打包 Android APK
install-apk.bat      :: 安装 APK 到已连接设备（可选参数：apk 路径）
open-port.bat        :: 放行防火墙 TCP 端口（手机访问电脑后端前先执行，需管理员，自动提权）
```

等价 npm 脚本：`npm run serve`（后台）、`npm run build:android`（APK）、`npm test`（jest）。

### 手机（Android）首次使用

1. 电脑运行 `serve-web.bat`（后端 + 页面，1420），再运行 `open-port.bat` 放行防火墙；
   `open-port.bat` 会把当前网络设为**专用(Private)**——Windows 在"公用网络"下开启隐身模式，
   会静默丢弃非请求入站 TCP（即使有放行规则也无效），这是手机连不上后端的最常见原因；
2. 手机与电脑连同一 WiFi，`dev-android.bat` 构建并安装壳 APK；
3. 打开 App，填电脑局域网 IP（如 `http://192.168.1.147:1420`）→ 自动跳转到 GM 页面并记住；
4. 之后前端改动只需在 App 内点右上角"刷新"。

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
- **明文 HTTP**：后端是局域网 `http://` 地址，`AndroidManifest.xml` 用 Tauri 占位符
  `android:usesCleartextTraffic="${usesCleartextTraffic}"`——debug 构建自动为 true（本项目的
  `build:android` 打的正是 debug APK）。若改用 release APK 需显式打开明文（如固定为 true），否则页面加载/请求会被拦截。

### Windows 首次构建环境准备

- **开发者模式**：Tauri 打包需要在 `jniLibs` 建符号链接，Windows 必须开启开发者模式
  （设置 → 隐私和安全性 → 开发者选项 → 开发者模式），否则报
  `Creation symbolic link is not allowed for this system`。开启后无需重启、无需管理员运行构建。
- **Gradle 仓库镜像**：`dl.google.com` 不可达时（如国内网络），`run-tauri.js` 会自动给生成的
  `gen/android` Gradle 文件插入阿里云 Maven 镜像（`maven.aliyun.com/repository/google` 放最前），幂等、无需手动处理。
- **pnpm 垫片**：Tauri Android 模板的 Gradle 插件默认调用 `pnpm tauri android android-studio-script ...`，
  本项目用 npm；`scripts/pnpm.cmd` 垫片把该调用转发给本项目的 `@tauri-apps/cli`（`run-tauri.js` 已把 `scripts/` 加入 PATH）。
- **build-tools**：AGP 8.11 需要 build-tools 35.0.0；缺失时用 sdkmanager 安装，或从国内镜像手动装
  （如腾讯镜像 `https://mirrors.cloud.tencent.com/AndroidSDK/build-tools_r35_windows.zip`，解压后放入
  `<SDK>/build-tools/35.0.0/`）。
- 工具链要求：Rust（rustup + 4 个 Android target）、Android SDK（platform-tools、NDK）、JDK 17+；
  `run-tauri.js` 会自动探测并设置 `ANDROID_HOME` / `JAVA_HOME` / cargo PATH。

## 通信协议

所有消息为 JSON 走 WebSocket。协议类型定义见 `server/src/types.ts`；数据流为客户端主导（客户端上报地图/物体/玩家状态，后台展示；GM 操作由后台转发命令给客户端，客户端不回执，后台快照为准）。
