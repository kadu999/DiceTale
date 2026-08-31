# DiceTale（骰子物语）

一个轻量级的桌游跑团（TRPG）Demo 项目：**Unity 客户端 + Node.js 客户端后台**。

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
├── backend/                      # Node.js 客户端后台（TypeScript + ws）
│   ├── src/                      # 后台源码（状态、会话、处理器、配置）
│   ├── public/                   # GM 控制台网页（Pad/手机友好）
│   ├── maps/                     # 地图贴图副本（*.png）
│   ├── config.json               # 后台配置（端口、地图目录）
│   ├── scripts/syncMaps.ts       # 从客户端同步地图到 maps/ 的辅助脚本
│   ├── data/                     # 状态存档（gamestate.json）
│   └── tests/                    # jest 测试
└── docs/                         # 设计与实现文档
```

## 后台启动

```bash
cd backend
npm install
npm run dev
```

Windows 也可以用一键脚本（`backend/` 目录下）：

```bat
build.bat      :: 安装依赖并编译 TypeScript（产出 dist/）
start.bat      :: 启动后台（缺编译产物时自动先 build）
open-port.bat  :: 放行后台端口防火墙（局域网客户端/Android 查看器连接时需要；需管理员，自动提权）
```

- GM 控制台：<http://localhost:1420/>
- 客户端 WebSocket：`ws://localhost:1420/client`
- GM WebSocket：`ws://localhost:1420/gm`
- 状态存档：`backend/data/gamestate.json`（后台记录，重启后自动恢复）

## 地图资源配置

后台**自持地图贴图副本**（不再直接读取客户端目录），默认目录 `backend/maps/`：

- `*.png`：地图贴图（GM 控制台显示用）。

配置优先级（高 → 低）：

1. 环境变量 `PORT`、`MAPS_DIR`（`mapsDir` 支持绝对路径或相对 `backend/` 的路径）；
2. `backend/config.json`（`port`、`mapsDir`；可用环境变量 `DICETALE_CONFIG` 指定其它配置文件）；
3. 内置默认值（`1420`、`maps`）。

客户端新增地图后，同步到后台（客户端资源目录可用环境变量 `DICETALE_CLIENT_ASSETS` 覆盖）：

```bash
cd backend
npm run sync:maps
```

## 数据流（客户端主导）

客户端（Unity）是地图与物体的主导者，后台被动接收并展示：

- 客户端加载地图后通过 `register_map_objects` 上报：地图名、出生点、所有后台物体（通用状态与位置）；
- 客户端通过 `register_players` 上报玩家名单，移动时通过 `report_player_position` 节流上报每个玩家的位置与所在地图；
- 后台记录这些信息，推送给 GM 控制台显示；
- 后台只负责**触发控制**：GM 传送、切换物体状态时向客户端下发命令执行。

GM 控制台显示的地图图片由后台静态提供（`/maps/{mapName}.png`，图片存于后台自己的 `backend/maps/` 目录），物体标记位置、玩家位置全部来自客户端上报。

## 运行测试

```bash
cd backend
npm test        # jest：游戏状态、持久化、WebSocket 协议流程
```

## Unity 客户端接入

1. 用 Unity 6（6000.3.x）打开 `client/`。
2. 为场景中需要后台控制的物体添加 `SceneObject` 组件（继承 `BackendObject` 通信基类），并配置显示名称、物体 ID 与状态列表（后台可用 `set_option` 按名称切换）；
3. 先启动后台再运行游戏，`BackendManager` 会自动连接 `ws://localhost:1420/client`，
   加载地图后自动上报出生点与后台物体（含位置）、玩家名单；玩家移动时自动上报位置。
4. 想离线运行：取消勾选 `BackendManager` 上的 `Use Server`（走本地 Mock）。

## 通信协议

所有消息均为 JSON，通过 WebSocket 传输。

- 后台 → GM 控制台的 `gm_update` 携带 `clientConnected`（客户端在线状态，单客户端架构断开即无客户端）；
- GM 操作失败（客户端未连接、超出道具库存等）时，后台返回 `gm_error` 提示原因；
- 后台对所有连接做心跳保活：GM 页面（浏览器）走 ws 级 ping/pong，Unity 客户端走应用层 `heartbeat` 消息（约 15s 上报），半开连接会被自动清理。

## License

MIT
