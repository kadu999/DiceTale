# DiceTale 权威服务器 MVP 设计文档

## 目标

为 DiceTale 增加一个基于 WebSocket 的远程权威服务器，使服务器能够控制游戏中的关键状态。本阶段（MVP）只实现两个核心能力：

1. **服务器控制门的开启**：玩家触碰门时，客户端向服务器请求权限，服务器决定是否允许通过/开启。
2. **服务器控制地图传送**：门的传送目标、GM 在网页后台发起的传送，都由服务器下发命令执行。

其他功能（事件触发、完整玩家属性/背包控制、复杂 GM 面板）在协议和接口上预留，但本阶段不实现。

## 范围

### 包含

- Node.js WebSocket 服务器，位于 `server/` 目录。
- GM 可视化网页后台，可查看当前地图、门状态、玩家位置，并手动开门/传送。
- Unity 客户端网络层改造：建立 WebSocket 连接、发送请求、接收并执行服务器命令。
- 门和传送相关的对象同步：客户端加载地图后上报门、出生点信息。
- 游戏状态 JSON 持久化（门状态、当前地图、玩家位置）。

### 不包含

- 多人联机同步。
- 事件触发由服务器控制。
- 玩家属性、背包的完整服务器管理。
- 客户端本地预测/插值优化。
- 复杂 GM UI（只保留门和传送相关面板）。

## 目录结构

```
DiceTale/
├── client/                           # Unity 客户端
│   └── Assets/DiceTale/Scripts/
│       ├── Server/                   # 新增
│       │   ├── ServerConnection.cs
│       │   └── WebSocketBackendService.cs
│       ├── BackendManager.cs         # 修改：改为 WebSocket 实现
│       ├── Door.cs                   # 修改：请求服务器开门/传送
│       ├── MapManager.cs             # 修改：上报对象、执行服务器切图命令
│       └── IBackendService.cs        # 保留，可能扩展
└── server/                           # 新增
    ├── src/
    │   ├── index.ts                  # 入口：启动 WS + HTTP 服务
    │   ├── GameState.ts              # 权威游戏状态
    │   ├── Player.ts                 # 玩家数据模型
    │   ├── ClientSession.ts          # 玩家客户端连接
    │   ├── GmSession.ts              # GM 网页连接
    │   ├── persistence.ts            # JSON 存档读写
    │   ├── handlers/
    │   │   ├── clientHandlers.ts     # 处理 C→S 请求
    │   │   └── gmHandlers.ts         # 处理 GM→S 指令
    │   └── commands/
    │       └── clientCommands.ts     # 构造 S→C 命令
    ├── public/                       # GM 网页后台
    │   ├── index.html
    │   ├── style.css
    │   └── app.js
    ├── data/
    │   └── gamestate.json            # 运行时存档
    ├── package.json
    └── tsconfig.json
```

## 通信协议

所有消息均为 JSON，通过 WebSocket 传输。消息分为三类：客户端请求（C→S）、服务器命令（S→C）、GM 指令（GM→S）。

### 客户端 → 服务器（C→S）

#### `request_join`

客户端连接成功后发送，请求加入游戏。

```json
{
  "type": "request_join"
}
```

#### `register_map_objects`

客户端加载地图后上报当前地图中的可控对象。本阶段只包含门和出生点。

```json
{
  "type": "register_map_objects",
  "mapName": "Map001",
  "doors": [
    {
      "id": "Door_A1",
      "targetMap": "Map002",
      "targetSpawn": "Default",
      "isPortal": true
    }
  ],
  "spawnPoints": [
    { "id": "Default" },
    { "id": "NorthEntrance" }
  ]
}
```

#### `request_door_access`

玩家触碰门时发送。

```json
{
  "type": "request_door_access",
  "doorId": "Door_A1"
}
```

#### `request_teleport`

玩家主动请求传送到某地图/出生点时发送。本阶段主要由门触发，也可由 GM 间接发起。

```json
{
  "type": "request_teleport",
  "mapName": "Map002",
  "spawnId": "Default"
}
```

#### `report_player_position`

玩家位置变化时客户端上报，用于 GM 后台显示。服务器本阶段不校验，只记录。

```json
{
  "type": "report_player_position",
  "position": { "x": 1.5, "y": 2.5 }
}
```

### 服务器 → 客户端（S→C）

#### `set_map`

切换当前地图。

```json
{
  "type": "set_map",
  "mapName": "Map002",
  "spawnId": "Default"
}
```

#### `set_door_state`

设置门状态。

```json
{
  "type": "set_door_state",
  "doorId": "Door_A1",
  "unlocked": true
}
```

#### `teleport_player`

将玩家传送到指定地图的出生点。

```json
{
  "type": "teleport_player",
  "mapName": "Map002",
  "spawnId": "Default"
}
```

#### `sync_state`

向客户端同步完整状态快照。

```json
{
  "type": "sync_state",
  "state": {
    "currentMap": "Map001",
    "player": {
      "position": { "x": 1.5, "y": 2.5 }
    },
    "doors": {
      "Door_A1": { "unlocked": true }
    }
  }
}
```

### GM 网页 → 服务器（GM→S）

#### `gm_open_door`

GM 点击开门按钮时发送。

```json
{
  "type": "gm_open_door",
  "doorId": "Door_A1"
}
```

#### `gm_teleport_player`

GM 点击传送按钮时发送。

```json
{
  "type": "gm_teleport_player",
  "mapName": "Map002",
  "spawnId": "Default"
}
```

#### `gm_refresh`

GM 请求服务器重新推送当前状态。

```json
{
  "type": "gm_refresh"
}
```

## 服务器状态设计

### GameState

```typescript
interface GameState {
  currentMap: string;
  player: PlayerState;
  doors: Record<string, DoorState>; // key = doorId
}

interface PlayerState {
  position: { x: number; y: number };
}

interface DoorState {
  unlocked: boolean;
  targetMap: string;
  targetSpawn: string;
  isPortal: boolean;
}
```

### 状态来源

- `currentMap`：由 `set_map` / `teleport_player` 更新。
- `doors`：由 `register_map_objects` 注册门信息，由 `gm_open_door` 或 `request_door_access` 更新 `unlocked`。
- `player.position`：本阶段由客户端通过 `report_player_position` 上报，服务器只做记录不校验。

## Unity 客户端改造

### 新增文件

#### `Server/ServerConnection.cs`

- 管理 WebSocket 连接生命周期（连接、断开、重连）。
- 提供 `Send(object message)` 方法发送 JSON。
- 收到消息后分发给 `ServerCommandDispatcher`（内联或单独类）。
- 连接成功后自动发送 `request_join`。

#### `Server/WebSocketBackendService.cs`

- 实现 `IBackendService`。
- 内部使用 `ServerConnection`。
- `RequestDoorAccess` 改为发送 `request_door_access`，并通过等待服务器命令完成回调。

### 修改文件

#### `BackendManager.cs`

- 移除 Inspector 上的 `useMock` / `apiBaseUrl` 字段，或保留但默认使用 WebSocket。
- `Awake()` 中创建 `WebSocketBackendService` 并连接服务器。
- 保留 `RequestDoorAccess(string doorId, Action<bool> callback)` 接口，供 `Door` 使用。
- 新增 `RequestTeleport(string mapName, string spawnId)` 用于向服务器请求传送（本阶段主要由门逻辑内部调用）。

#### `Door.cs`

玩家触碰门时，统一向服务器请求许可，由服务器决定后续行为：

```csharp
public void Interact(Player player)
{
    if (BackendManager.Instance != null && !string.IsNullOrEmpty(doorId))
    {
        BackendManager.Instance.RequestDoorAccess(doorId, allowed =>
        {
            if (allowed)
            {
                ExecuteInteract();
            }
        });
        return;
    }

    ExecuteInteract();
}
```

- **非传送门**（`isPortal = false`）：服务器返回 `allowed = true` 并下发 `set_door_state(doorId, true)`。客户端在回调中调用 `ExecuteInteract()`，解锁门并刷新碰撞体。
- **传送门**（`isPortal = true`）：服务器返回 `allowed = true`，并直接下发 `teleport_player(mapName, spawnId)`。客户端收到命令后切换地图，`Door` 本地的 `targetSceneName` 仅作为客户端配置参考，实际目标以服务器命令为准。
- 如果服务器返回 `allowed = false`，客户端不执行任何操作。

#### `MapManager.cs`

- `LoadMap` 完成后，收集当前地图中所有 `Door` 和 `SpawnPoint`，发送 `register_map_objects`。
- 监听服务器命令：
  - `set_map`：调用 `LoadMap(mapName, spawnId)`。
  - `teleport_player`：调用 `LoadMap(mapName, spawnId)`。
  - `set_door_state`：找到对应 `Door` 调用 `SetUnlocked(unlocked)`。

## Node.js 服务器改造

### 依赖

- `ws`：WebSocket 服务器。
- `express`：可选，用于托管 GM 网页静态文件；也可用 Node.js 内置 `http`。
- `typescript` + `ts-node` / `tsx`：开发时使用；生产可编译为 JS。

### 核心模块

#### `index.ts`

- 创建 HTTP 服务器。
- 用 `express.static` 托管 `public/`。
- 在同一端口创建 WebSocket 服务器。
- 区分连接类型：
  - 路径 `/client`：玩家客户端。
  - 路径 `/gm`：GM 网页。
- 启动时从 `data/gamestate.json` 加载状态；状态变更时写入文件。

#### `GameState.ts`

- 单例，保存权威状态。
- 提供方法：
  - `setMap(mapName, spawnId)`
  - `registerDoors(mapName, doors)`
  - `registerSpawnPoints(mapName, spawnPoints)`
  - `setDoorUnlocked(doorId)`
  - `setPlayerPosition(position)`

#### `ClientSession.ts`

- 代表一个玩家客户端连接。
- 处理 C→S 消息。
- 调用 `GameState` 更新状态。
- 通过 `clientCommands` 下发命令。

#### `GmSession.ts`

- 代表一个 GM 网页连接。
- 处理 GM→S 消息。
- 连接成功后自动推送当前完整状态（用于渲染面板）。
- 状态变更时接收广播。

#### `persistence.ts`

- `load()`：从 `data/gamestate.json` 读取状态。
- `save(state)`：将状态写入文件，状态变更时异步调用。

### 请求处理逻辑

#### `request_join`

1. 标记会话为已加入。
2. 如果存档中没有当前地图，使用默认地图 `Map001`。
3. 发送 `sync_state`。

#### `register_map_objects`

1. 更新 `GameState.doors` 和 `GameState.spawnPoints`。
2. 合并时保留已有的 `unlocked` 状态（重新加载地图后仍记得哪些门已开）。
3. 推送更新后的状态给 GM。

#### `request_door_access`

1. 在 `GameState.doors` 中查找 `doorId`。
2. 如果门不存在，记录警告并忽略。
3. 如果门已解锁（`unlocked = true`）：
   - 对传送门：发送 `teleport_player(targetMap, targetSpawn)`。
   - 对普通门：发送 `set_door_state(doorId, true)` 作为状态同步。
   - 调用 `callback(true)`（如果后端接口需要）。
4. 如果门未解锁：
   - 本阶段默认允许开启，设置 `unlocked = true`。
   - 对传送门：发送 `teleport_player(targetMap, targetSpawn)`。
   - 对普通门：发送 `set_door_state(doorId, true)`。
   - 调用 `callback(true)`。
   - 保存状态并通知 GM。
5. 未来将支持 GM 锁门或条件判断；本阶段不拒绝任何有效门的请求。

#### `gm_open_door`

1. 设置 `GameState.doors[doorId].unlocked = true`。
2. 发送 `set_door_state(doorId, true)` 给客户端。
3. 广播状态给 GM。
4. 保存状态。

#### `gm_teleport_player`

1. 更新 `GameState.currentMap`。
2. 发送 `teleport_player(mapName, spawnId)` 给客户端。
3. 广播状态给 GM。
4. 保存状态。

## GM 网页后台

### 页面布局

- **顶部**：显示当前连接的客户端状态（在线/离线）。
- **左侧面板**：
  - 当前地图名称。
  - 玩家当前位置（X, Y）。
- **中间面板**：
  - 门列表：显示门 ID、目标地图、目标出生点、锁定状态。
  - 每扇门后有一个「开门」按钮。
- **右侧面板**：
  - 传送控制：下拉选择已知地图和出生点，点击「传送玩家」。
- **底部**：原始消息日志（可选）。

### 交互流程

1. 页面加载后连接 `ws://host:port/gm`。
2. 连接成功后服务器推送 `sync_state`。
3. 页面根据状态渲染门列表和传送选项。
4. 用户点击按钮时发送对应 GM 指令。
5. 服务器下发命令后，客户端执行；GM 页面通过状态广播刷新显示。

## 持久化

- 文件：`server/data/gamestate.json`。
- 保存时机：任何状态变更后防抖保存（如 500ms 内多次变更只写一次）。
- 加载时机：服务器启动时。
- 保存内容：
  ```json
  {
    "currentMap": "Map001",
    "player": {
      "position": { "x": 1.5, "y": 2.5 }
    },
    "doors": {
      "Door_A1": { "unlocked": true }
    }
  }
  ```

## 启动流程

### 服务器启动

```bash
cd server
npm install
npm run dev
```

服务器监听 `ws://localhost:8080/client` 和 `ws://localhost:8080/gm`，HTTP 托管 GM 页面在 `http://localhost:8080/`。

### 客户端启动

1. 运行 Unity 场景。
2. `BackendManager` 连接 `ws://localhost:8080/client`。
3. 连接成功后发送 `request_join`。
4. 服务器返回 `sync_state`。
5. `MapManager` 加载默认地图。
6. 加载完成后发送 `register_map_objects`。

## 错误处理

- 客户端断开：服务器标记客户端离线，保留游戏状态，等待重连。
- 服务器不可达：客户端显示提示，定期重连。
- 未知消息类型：服务器记录日志并忽略。
- 找不到门/出生点：服务器返回警告日志，不下发命令。

## 预留扩展点

以下消息类型在协议中预留，MVP 不处理：

- `gm_trigger_event`：GM 触发事件。
- `gm_set_player_attr`：GM 修改玩家属性。
- `gm_give_item` / `gm_take_item`：GM 给/收道具。
- `request_pick_item`：玩家拾取道具。
- `request_move`：玩家移动请求。

这些将在后续阶段实现。

## 边界约定

- 客户端不直接修改门状态和当前地图，只通过服务器命令执行。
- 服务器是权威状态源，JSON 文件是权威状态的持久化副本。
- GM 网页只读 + 下发指令，不直接修改状态。
- 本阶段玩家位置由客户端上报，服务器记录但不校验，用于 GM 显示。
