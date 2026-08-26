# DiceTale（骰子物语）

一个轻量级的桌游跑团（TRPG）Demo 项目：**Unity 客户端 + Node.js 权威服务器**。
服务器作为后台控制前端的关键游戏状态（门开启、地图传送），并提供 GM 可视化网页后台。

## 项目结构

```
DiceTale/
├── client/                       # Unity 客户端（Unity 6 / 6000.3.x）
│   └── Assets/DiceTale/Scripts/
│       ├── Server/               # WebSocket 连接层（连接、命令分发、JSON 解析）
│       ├── BackendManager.cs     # 后端入口（默认连服务器，可切本地 Mock）
│       └── ...
├── server/                       # Node.js 权威服务器（TypeScript + ws）
│   ├── src/                      # 服务器源码（状态、会话、处理器）
│   ├── public/                   # GM 网页后台
│   ├── data/                     # 游戏状态存档（gamestate.json）
│   └── tests/                    # jest 测试
└── docs/                         # 设计与实现文档
```

## 服务器启动

```bash
cd server
npm install
npm run dev
```

Windows 也可以用一键脚本（`server/` 目录下）：

```bat
build.bat   :: 安装依赖并编译 TypeScript（产出 dist/）
start.bat   :: 启动服务器（缺编译产物时自动先 build）
```

- GM 控制台：<http://localhost:8080/>
- 客户端 WebSocket：`ws://localhost:8080/client`
- GM WebSocket：`ws://localhost:8080/gm`
- 状态存档：`server/data/gamestate.json`（服务器是权威状态源，重启后自动恢复）

## 数据流（客户端主导）

客户端（Unity）是地图与物体的主导者，服务器被动接收并展示：

- 客户端加载地图后通过 `register_map_objects` 上报：地图名、**门**（id、图片归一化位置、目标地图/出生点、是否传送门）、出生点；
- 客户端移动时通过 `report_player_position` 节流上报玩家位置；
- 服务器把这些信息存为权威状态，推送给 GM 网页显示；
- 服务器只负责**触发控制**：GM 开门/关门/传送时向客户端下发命令执行。

GM 页面显示的地图图片由服务器静态提供（`/maps/{mapName}.png`），门的标记位置、玩家位置全部来自客户端上报。

## 运行测试

```bash
cd server
npm test        # jest：游戏状态、持久化、WebSocket 协议流程
```

## Unity 客户端接入

1. 用 Unity 6（6000.3.x）打开 `client/`。
2. 为场景中需要服务器控制的「门」添加 `Door` 组件，并填写：
   - `Door Id`（如 `Door_A1`，与 GM 后台一一对应）
   - `Target Scene Name` / `Target Spawn Id`（传送目标地图与出生点）
   - 传送门勾选 `Is Portal`
3. 先启动服务器再运行游戏，`BackendManager` 会自动连接 `ws://localhost:8080/client`，
   加载地图后自动上报门（含位置）与出生点；玩家移动时自动上报位置。
4. 想离线运行：取消勾选 `BackendManager` 上的 `Use Server`（走本地 Mock）。

## 通信协议

所有消息均为 JSON，通过 WebSocket 传输。完整协议与设计见
`docs/superpowers/specs/2026-08-26-authoritative-server-mvp-design.md`。

## License

MIT
