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
│   ├── src/                      # 后台源码（状态、会话、处理器）
│   ├── public/                   # GM 控制台网页（Pad/手机友好）
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
build.bat   :: 安装依赖并编译 TypeScript（产出 dist/）
start.bat   :: 启动后台（缺编译产物时自动先 build）
```

- GM 控制台：<http://localhost:8080/>
- 客户端 WebSocket：`ws://localhost:8080/client`
- GM WebSocket：`ws://localhost:8080/gm`
- 状态存档：`backend/data/gamestate.json`（后台记录，重启后自动恢复）

## 数据流（客户端主导）

客户端（Unity）是地图与物体的主导者，后台被动接收并展示：

- 客户端加载地图后通过 `register_map_objects` 上报：地图名、出生点、所有后台物体（通用状态与位置）；
- 客户端通过 `register_players` 上报玩家名单，移动时通过 `report_player_position` 节流上报每个玩家的位置与所在地图；
- 后台记录这些信息，推送给 GM 控制台显示；
- 后台只负责**触发控制**：GM 传送、切换物体状态时向客户端下发命令执行。

GM 控制台显示的地图图片由后台静态提供（`/maps/{mapName}.png`），物体标记位置、玩家位置全部来自客户端上报。

## 运行测试

```bash
cd backend
npm test        # jest：游戏状态、持久化、WebSocket 协议流程
```

## Unity 客户端接入

1. 用 Unity 6（6000.3.x）打开 `client/`。
2. 为场景中需要后台控制的物体添加 `SceneObject` 组件（继承 `BackendObject` 通信基类），并配置显示名称、物体 ID 与状态列表（后台可用 `set_object_state` 按名称切换）；
3. 先启动后台再运行游戏，`BackendManager` 会自动连接 `ws://localhost:8080/client`，
   加载地图后自动上报出生点与后台物体（含位置）、玩家名单；玩家移动时自动上报位置。
4. 想离线运行：取消勾选 `BackendManager` 上的 `Use Server`（走本地 Mock）。

## 通信协议

所有消息均为 JSON，通过 WebSocket 传输。

## License

MIT
