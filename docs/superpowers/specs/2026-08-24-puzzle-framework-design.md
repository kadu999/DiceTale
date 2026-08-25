# DiceTale 组件化解谜框架设计文档

## 目标

将 `DiceTale` 从空壳管理器扩展为可支撑**桌游跑团 + 关卡解谜推进**的最小框架：

1. 所有场景对象均可交互、可触发事件。
2. 通过组件组合在 Unity 中直接编辑地图和谜题逻辑。
3. 支持"事件触发 → 条件检查 → 状态推进"的核心解谜循环。

## 设计原则

- **组件化**：每个行为都是一个可挂载的 MonoBehaviour，方便在 Inspector 中配置。
- **场景内生命周期**：所有管理器随当前场景创建和销毁，与之前管理器设计保持一致。
- **事件驱动**：对象之间通过事件总线通信，降低耦合。
- **Demo 级复杂度**：不引入 ScriptableObject 事件资源，先用 `string` 事件 ID，后续可升级。

## 文件变更

### 新增文件

放在 `client/Assets/DiceTale/Scripts/` 根目录：

- `IInteractable.cs`：交互接口
- `Interactable.cs`：可交互组件
- `GameEventBus.cs`：全局事件总线
- `ProgressManager.cs`：解谜进度管理器
- `GameEventListener.cs`：事件监听组件
- `ICondition.cs` / `Condition.cs`：条件接口和基类
- `EventCondition.cs`：事件条件检查
- `ItemCondition.cs`：物品条件检查
- `InteractionManager.cs`：输入交互管理器
- `Item.cs`：物品行为组件
- `Door.cs`：门行为组件

### 修改文件

- `GameManager.cs`：初始化 `ProgressManager`、`InteractionManager`
- `Character.cs`：完善背包 API

### 删除文件

- `SceneObject.cs`、`SceneItem.cs`、`SceneDoor.cs`、`Scene.cs`、`SceneData.cs`：组件化后不再需要这些标识/数据类

## 类设计

### `IInteractable`

```csharp
public interface IInteractable
{
    void Interact(Player player);
}
```

### `Interactable`

让对象可被点击交互的组件，同时承载对象标识信息。

| 成员 | 类型 | 说明 |
|------|------|------|
| `Id` | `string` | 对象唯一标识 |
| `DisplayName` | `string` | 显示名称 |
| `InteractionText` | `string` | 交互提示文本 |
| `OnInteract` | `UnityEvent` | 额外响应事件 |
| `Interact(Player player)` | `void` | 执行交互，调用同对象上所有 `IInteractable` |

### `Item`

物品行为组件，实现 `IInteractable`。

| 成员 | 类型 | 说明 |
|------|------|------|
| `ItemId` | `string` | 物品 ID |
| `EventName` | `string` | 拾取时触发的事件名 |
| `Interact(Player player)` | `void` | 加入背包 + 触发事件 + 销毁自身 |

### `Door`

门行为组件，实现 `IInteractable`。

| 成员 | 类型 | 说明 |
|------|------|------|
| `TargetSceneName` | `string` | 目标场景名 |
| `Conditions` | `Condition[]` | 开门条件列表 |
| `Interact(Player player)` | `void` | 条件满足则加载目标场景，否则提示 |

### `Condition`（抽象基类）

| 成员 | 类型 | 说明 |
|------|------|------|
| `IsMet(Player player)` | `abstract bool` | 子类实现具体检查 |

### `EventCondition`

| 成员 | 类型 | 说明 |
|------|------|------|
| `EventName` | `string` | 需要已触发的事件 |
| `IsMet(Player player)` | `bool` | 查询 `ProgressManager` |

### `ItemCondition`

| 成员 | 类型 | 说明 |
|------|------|------|
| `ItemId` | `string` | 需要的物品 ID |
| `IsMet(Player player)` | `bool` | 查询玩家背包 |

### `GameEventBus`

静态事件总线。

| 成员 | 类型 | 说明 |
|------|------|------|
| `Raise(string eventName)` | `static void` | 触发事件 |
| `On(string eventName, Action callback)` | `static void` | 订阅事件 |
| `Off(string eventName, Action callback)` | `static void` | 取消订阅 |

### `ProgressManager`

记录解谜进度。

| 成员 | 类型 | 说明 |
|------|------|------|
| `TriggeredEvents` | `HashSet<string>` | 已触发事件集合 |
| `RaiseEvent(string eventName)` | `void` | 触发事件并通知总线 |
| `HasEvent(string eventName)` | `bool` | 查询事件是否已触发 |

### `GameEventListener`

挂在场景对象上监听事件。

| 成员 | 类型 | 说明 |
|------|------|------|
| `EventName` | `string` | 监听的事件名 |
| `OnEvent` | `UnityEvent` | 事件触发时调用 |

### `InteractionManager`

处理输入并分发交互。

| 成员 | 类型 | 说明 |
|------|------|------|
| `TryInteract()` | `void` | 从屏幕中心或鼠标位置发射射线，找到 `Interactable` 并调用 |

### `Character`

| 成员 | 类型 | 说明 |
|------|------|------|
| `AddItem(Item item)` | `void` | 添加物品 |
| `HasItem(string itemId)` | `bool` | 检查物品 |
| `RemoveItem(string itemId)` | `bool` | 移除物品 |

## 启动顺序

```
Main.Awake()
  └── GameManager.Awake()
        ├── SceneManager
        ├── CharacterManager
        ├── ProgressManager
        └── InteractionManager
```

## 地图编辑 workflow

1. 创建空 GameObject，根据对象类型挂载组件：
   - 可拾取物品：`Interactable + Item`
   - 可开启的门：`Interactable + Door + ItemCondition`
   - 环境机关：`Interactable + GameEventListener`
2. 在 Inspector 中填写 `Id`、`DisplayName`、`ItemId`、`EventName`、`TargetSceneName` 等字段。
3. 确保对象上有 **Collider**，否则 `InteractionManager` 的射线检测不到。

## 使用示例

### 宝箱拾取钥匙

对象组件：`Interactable + Item`

```csharp
// Interactable 配置
Id = "Chest001"
DisplayName = "旧宝箱"

// Item 配置
ItemId = "Key"
EventName = "GotKey"
```

### 需要钥匙的门

对象组件：`Interactable + Door + ItemCondition`

```csharp
// Interactable 配置
Id = "Door001"
DisplayName = "铁门"

// Door 配置
TargetSceneName = "Scene002"

// ItemCondition 配置
ItemId = "Key"
```

## 后续可扩展点

1. **对话系统**：增加 `DialogueInteractable` 组件，交互时弹出对话。
2. **多条件组合**：增加 `AllConditions` / `AnyCondition` 组合条件组件。
3. **事件可视化**：将 `string` 事件 ID 升级为 `GameEvent` ScriptableObject，支持 Inspector 下拉选择。
4. **存档读档**：将 `ProgressManager.TriggeredEvents` 和 `Character` 背包序列化保存。
