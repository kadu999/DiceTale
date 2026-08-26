# DiceTale（骰子物语）

一个轻量级的桌游跑团（TRPG）Demo 项目：**Unity 客户端 + Node.js 客户端后台**。

架构是**单客户端 ↔ 单后台**：只有一个 Unity 客户端，配套一个专属于它的后台控制台。
后台不面向多客户端，只负责接收客户端上报的状态并显示（地图、门、玩家位置），以及触发控制（门开关、传送）。

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

- 客户端加载地图后通过 `register_map_objects` 上报：地图名、**门**（id、图片归一化位置、目标地图/出生点、是否传送门）、出生点；
- 客户端通过 `register_players` 上报玩家名单，移动时通过 `report_player_position` 节流上报每个玩家的位置与所在地图；
- 后台记录这些信息，推送给 GM 控制台显示；
- 后台只负责**触发控制**：GM 开门/关门/传送时向客户端下发命令执行。

GM 控制台显示的地图图片由后台静态提供（`/maps/{mapName}.png`），门的标记位置、玩家位置全部来自客户端上报。

## 运行测试

```bash
cd backend
npm test        # jest：游戏状态、持久化、WebSocket 协议流程
```

## Unity 客户端接入

1. 用 Unity 6（6000.3.x）打开 `client/`。
2. 为场景中需要后台控制的「门」添加 `Door` 组件，并填写：
   - `Door Id`（如 `Door_A1`，与 GM 控制台一一对应）
   - `Target Scene Name` / `Target Spawn Id`（传送目标地图与出生点）
   - 传送门勾选 `Is Portal`
3. 先启动后台再运行游戏，`BackendManager` 会自动连接 `ws://localhost:8080/client`，
   加载地图后自动上报门（含位置）、出生点与玩家名单；玩家移动时自动上报位置。
4. 想离线运行：取消勾选 `BackendManager` 上的 `Use Server`（走本地 Mock）。

## 通信协议

所有消息均为 JSON，通过 WebSocket 传输。

## License

MIT
