# DiceTale（骰子物语）

一个轻量级的桌游跑团（TRPG）Demo 项目：**Unity 客户端 + GM 控制台后台**。

架构是**单客户端 ↔ 单后台**：只有一个 Unity 客户端，配套一个专属于它的后台控制台。
后台不面向多客户端，只负责接收客户端上报的状态并显示（地图、玩家位置、物体状态），以及触发控制（传送、切换物体状态）。

## 项目结构

```
DiceTale/
├── client/                       # Unity 客户端（Unity 6 / 6000.3.x）
│   └── Assets/DiceTale/Scripts/
│       ├── Server/               # WebSocket 连接层（连接、命令分发、JSON 解析）
│       ├── BackendManager.cs     # 后端入口（默认连后台，可切本地 Mock）
│       └── ...
├── backend_tauri2/               # 当前版 GM 控制台（PC 浏览器 + Android 壳）
│   ├── server/                   # Node.js 后台（TypeScript + ws，含 jest 测试；同源托管前端页面）
│   ├── src/                      # GM 控制台前端（静态网页，由后端同源托管，改完刷新即生效）
│   ├── src-tauri/                # Tauri 2 Android 壳（窗口 + 引导页跳转后端 URL，不内嵌 GM 页面）
│   ├── scripts/                  # run-tauri.js（Android 构建入口）、ui-check.js（前端布局自动验证）
│   └── README.md                 # 详细配置、启动与开发回路说明（配置项全部收敛于此）
├── backend/                      # 旧版后台（已由 backend_tauri2 取代，仅存档）
├── tools/                        # 工具脚本（items.json 转换、前端测试等）
└── docs/                         # 设计与实现文档
```

## 启动（当前版 backend_tauri2）

```bat
cd backend_tauri2
npm install
serve-web.bat        :: PC 入口：单端口后台 + 网页，浏览器打开 http://localhost:1420/
dev-android.bat      :: 构建并安装 Android debug APK（壳，只需构建一次；前端迭代靠刷新）
build-android.bat    :: 打包 Android APK
install-apk.bat      :: 安装 APK 到已连接设备
open-port.bat        :: 放行防火墙端口，让手机能访问电脑后端（手机首次使用前执行）
```

- GM 控制台：<http://localhost:1420/>（页面由后端同源托管，前端改动后刷新即生效，无需重打包）
- 客户端 WebSocket：`ws://localhost:1420/client`
- GM WebSocket：`ws://localhost:1420/gm`
- Android 壳首次打开时填电脑局域网 IP（如 `http://192.168.1.33:1420`），地址保存在手机本机；
  全部配置项与说明见 [backend_tauri2/README.md](backend_tauri2/README.md)：`server/config.json`（端口、地图目录、调试开关、WS 消息上限）。

## 地图资源配置

后台**自持地图贴图副本**（不直接读取客户端目录），默认目录 `backend_tauri2/server/maps/`：

- `*.png`：地图贴图（GM 控制台显示用；`ACT/FX/Room/Carriage` 开头与 `__v` 版本号文件会被过滤，不进入地图列表）。

配置优先级（高 → 低）：

1. 环境变量 `PORT`、`MAPS_DIR`（`mapsDir` 支持绝对路径或相对 `server/` 的路径）、`DEBUG_WS`、`MAX_MESSAGE_MB`；
2. `backend_tauri2/server/config.json`（`port`、`mapsDir`、`debugWs`、`maxMessageMb`；可用环境变量 `DICETALE_CONFIG` 指定其它配置文件）；
3. 内置默认值（`1420`、`maps`、`false`、`16`）。

客户端新增地图后，把 `*.png` 复制到 `backend_tauri2/server/maps/` 即可。

## 数据流（客户端主导）

客户端（Unity）是地图与物体的主导者，后台被动接收并展示：

- 客户端加载地图后通过 `register_map_objects` 上报：地图名、出生点、所有后台物体（通用状态与位置）；
- 客户端通过 `register_players` 上报玩家名单，移动时通过 `report_player_position` 节流上报每个玩家的位置与所在地图；
- 后台记录这些信息，推送给 GM 控制台显示；
- 后台只负责**触发控制**：GM 传送、切换物体状态时向客户端下发命令执行。

> 注意：后台是**运行时状态**，客户端断开即清空（单客户端架构），无持久化存档。

GM 控制台显示的地图图片由后台静态提供（`/maps/{mapName}.png`，图片存于 `server/maps/`），物体标记位置、玩家位置全部来自客户端上报。

## 运行测试

```bash
cd backend_tauri2
npm test        # jest：游戏状态、WebSocket 协议流程（GameState + server 集成）
```

## Unity 客户端接入

1. 用 Unity 6（6000.3.x）打开 `client/`。
2. 为场景中需要后台控制的物体添加 `SceneObject` 组件（继承 `BackendObject` 通信基类），并配置显示名称、物体 ID 与状态列表（后台可用 `set_option` 按名称切换）；
3. 先启动后台再运行游戏，`BackendManager` 会自动连接 `ws://localhost:1420/client`，
   加载地图后自动上报出生点与后台物体（含位置）、玩家名单；玩家移动时自动上报位置。
4. 想离线运行：取消勾选 `BackendManager` 上的 `Use Server`（走本地 Mock）。

## 通信协议

所有消息均为 JSON，通过 WebSocket 传输（协议类型定义见 `backend_tauri2/server/src/types.ts`）。

- 后台 → GM 控制台的 `gm_update` 携带 `clientConnected`（客户端在线状态，单客户端架构断开即无客户端）；
- GM 操作失败（客户端未连接、超出道具库存等）时，后台返回 `gm_error` 提示原因；
- 后台对所有连接做心跳保活：GM 页面（浏览器）走 ws 级 ping/pong，Unity 客户端走应用层 `heartbeat` 消息（约 15s 上报），半开连接会被自动清理。

## License

MIT
