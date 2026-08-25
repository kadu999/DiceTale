# DiceTale 核心管理器设计文档

## 目标

补全 `DiceTale` 核心管理器骨架，使项目具备一个可运行的最小闭环：

1. 有一个总控 `Game` 负责游戏生命周期和状态。
2. `SceneManager` 能真正异步加载场景并暴露进度事件。
3. `CharacterManager` 能创建和管理玩家角色。
4. `Main` 作为入口，只负责启动 `Game`。

**生命周期约定**：所有管理器均为场景内对象，不跨场景存活。切场景后由新场景自行重建。

## 文件变更

所有脚本放在 `client/Assets/DiceTale/Scripts/` 根目录：

- **新增**：`Game.cs`
- **修改**：`SceneManager.cs`
- **修改**：`CharacterManager.cs`
- **修改**：`Main.cs`

## 类设计

### `DiceTale.Game`

当前场景的总控，不跨场景。所有子管理器都挂在 `Game` 对象下。

| 成员 | 类型 | 说明 |
|------|------|------|
| `SceneManager` | `SceneManager` | 当前场景的场景管理器 |
| `CharacterManager` | `CharacterManager` | 当前场景的角色管理器 |
| `ProgressManager` | `ProgressManager` | 解谜进度管理器 |
| `InteractionManager` | `InteractionManager` | 输入交互管理器 |
| `MapManager` | `MapManager` | 地图管理器 |
| `State` | `GameState` | 当前游戏状态 |
| `Awake()` | `void` | 查找或创建各个子管理器，挂到 `Game` 下 |
| `ChangeState(GameState newState)` | `void` | 切换游戏状态 |

#### `GameState` 枚举

```csharp
public enum GameState
{
    Boot,
    MainMenu,
    PlayerSelection,
    Playing
}
```

### `DiceTale.SceneManager`

场景加载器，当前场景内使用。

| 成员 | 类型 | 说明 |
|------|------|------|
| `CurrentSceneName` | `string` | 当前场景名 |
| `IsLoading` | `bool` | 是否正在加载 |
| `Progress` | `float` | 加载进度 `[0, 1]` |
| `OnSceneLoadStarted` | `Action<string>` | 开始加载事件 |
| `OnSceneLoadProgressChanged` | `Action<float>` | 进度变化事件 |
| `OnSceneLoadCompleted` | `Action<string>` | 加载完成事件 |
| `LoadScene(string sceneName)` | `void` | 异步加载单场景 |

### `DiceTale.CharacterManager`

角色管理器，当前场景内使用。

| 成员 | 类型 | 说明 |
|------|------|------|
| `Players` | `List<Player>` | 玩家列表 |
| `CurrentPlayer` | `Player` | 当前活跃玩家 |
| `CurrentPlayerIndex` | `int` | 当前玩家索引 |
| `AddPlayer(Player player)` | `void` | 添加玩家 |
| `SetCurrentPlayer(int index)` | `void` | 设置当前玩家 |
| `NextPlayer()` | `void` | 切换到下一个玩家 |
| `ClearPlayers()` | `void` | 清空并销毁所有玩家 |

### `DiceTale.Main`

入口脚本。

- `Awake()` 中只添加 `Game` 组件。
- 不直接操作 `SceneManager` 或 `CharacterManager`。

## 启动顺序

```
Main.Awake()
  └── Game.Awake()
        ├── 查找或创建 SceneManager（挂到 Game 下）
        ├── 查找或创建 CharacterManager（挂到 Game 下）
        ├── 查找或创建 ProgressManager（挂到 Game 下）
        ├── 查找或创建 InteractionManager（挂到 Game 下）
        └── 查找或创建 MapManager（挂到 Game 下）
```

## 访问方式

由于管理器不跨场景，其他脚本通过 `FindObjectOfType<Game>()` 获取总控，再访问子管理器：

```csharp
var game = FindObjectOfType<Game>();
game.SceneManager.LoadScene("Demo");
```

## 边界约定

- `Game` 不直接调用 `UnityEngine.SceneManagement`，只调用 `SceneManager`。
- `SceneManager` 负责所有场景加载细节。
- `CharacterManager` 管理玩家列表，当前玩家由 `CurrentPlayer` 指定。
- 所有管理器均不调用 `DontDestroyOnLoad`，切场景后由新场景重建。

## 使用示例

```csharp
using UnityEngine;

namespace DiceTale
{
    public class MainMenu : MonoBehaviour
    {
        public void OnStartGameClicked()
        {
            var game = FindObjectOfType<Game>();
            game.ChangeState(GameState.Playing);
            game.SceneManager.LoadScene("Demo");
        }
    }
}
```

## 后续可扩展点

1. **存档系统**：由于管理器不跨场景，存档读档逻辑需要单独设计，加载存档后在新场景中恢复数据。
2. **UI 管理**：新增 `UIManager`，订阅 `Game.State` 或查询状态来切换 UI 面板。
3. **音频管理**：新增 `AudioManager`，由 `Game` 初始化。
4. **场景预设回归**：如果后续需要 ScriptableObject 场景预设，可以在 `SceneManager` 中增加 `LoadScene(Scene scene)` 重载。
