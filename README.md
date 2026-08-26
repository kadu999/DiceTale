# DiceTale（骰子物语）

一个轻量级的桌游跑团（TRPG）Demo 项目：**Unity 客户端 + Node.js 权威服务器**。
服务器作为后台控制前端的关键游戏状态（门开启、地图传送、**地图编辑**），并提供 GM 可视化网页后台。
客户端只负责**从服务器下载地图**游玩，不在前端编辑地图。

## 项目结构

```
DiceTale/
├── client/                       # Unity 客户端（Unity 6 / 6000.3.x）
│   └── Assets/DiceTale/Scripts/
│       ├── Server/               # WebSocket 连接层（连接、命令分发、JSON 解析）
│       ├── BackendManager.cs     # 后端入口（默认连服务器，可切本地 Mock）
│       └── ...
├── server/                       # Node.js 权威服务器（TypeScript + ws）
│   ├── src/                      # 服务器源码（状态、会话、处理器、地图目录、网格数据）
│   ├── public/                   # GM 网页后台（地图查看/编辑、门控制、传送）
│   ├── data/
│   │   ├── gamestate.json        # 游戏状态存档（门状态、当前地图等）
│   │   └── maps/                 # 地图网格数据（服务器权威，可编辑）
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
- 地图图片：<http://localhost:8080/maps/Map001.png>
- 网格数据：<http://localhost:8080/maps/Map001.bytes>（客户端下载用）
- 网格编辑 API：`GET/PUT /api/maps/{name}/grid`（JSON）

## 地图编辑（GM 网页）

1. 打开 GM 控制台，切到要编辑的地图 Tab，点「编辑网格」。
2. 选择画笔（**障碍** / **擦除**），在地图上拖拽绘制。
3. 点「保存网格」写回服务器（`server/data/maps/{name}.bytes`）。
4. 首次启动服务器时，会从客户端 `Resources/Map*.bytes` 自动播种网格数据；
   没有数据的地图会提示创建默认 64×36 空网格。

门的配置（id、位置、目标地图、是否传送门）在 `server/src/mapCatalog.ts`。

## Unity 客户端接入

1. 用 Unity 6（6000.3.x）打开 `client/`。
2. 先启动服务器再运行游戏：
   - `MapManager` 从服务器下载地图图片与网格数据（`http://localhost:8080/maps/...`）；
   - 服务器不可用时回退本地 `Resources` 资源，可离线运行。
3. `BackendManager` 自动连接 `ws://localhost:8080/client`，加载地图后自动上报门与出生点。
4. 想完全离线：取消勾选 `BackendManager` 上的 `Use Server`（走本地 Mock）。

## 运行测试

```bash
cd server
npm test        # jest：游戏状态、持久化、WebSocket 协议、网格数据与 API
```

## 通信协议

所有消息均为 JSON，通过 WebSocket 传输。完整协议与设计见
`docs/superpowers/specs/2026-08-26-authoritative-server-mvp-design.md`。

## License

MIT
