# DiceTale 场景管理设计文档

## 背景与目标

`DiceTale` 是一个轻量级桌游跑团 Demo。当前 Unity 客户端仅有一个空 `Main.cs`，需要一个简单的场景管理系统来：

1. 以**预设对象**的方式配置场景（ScriptableObject）。
2. 在**内存中记录当前场景的运行时数据**。
3. 提供异步加载/卸载场景的能力，并暴露进度事件供 UI 或逻辑订阅。

本设计保持 Demo 阶段的简洁性：不过渡动画、不引入场景栈、不做持久化。

## 文件结构

所有文件均放在 `client/Assets/DiceTale/Scripts/` 根目录下：

```
Assets/DiceTale/Scripts/
├── Scene.cs          # 场景预设 ScriptableObject
├── SceneData.cs      # 运行时场景内存数据
└── SceneManager.cs   # 场景管理器（单例 MonoBehaviour）
```

## 类设计

### `DiceTale.Scene`（场景预设）

继承 `ScriptableObject`，作为可在 Project 窗口中创建的资源。

| 字段 | 类型 | 说明 |
|------|------|------|
| `SceneName` | `string` | Unity 场景文件名（如 `MainMenu`） |
| `DisplayName` | `string` | 显示名称（如 `主菜单`） |
| `Description` | `string` | 场景描述 |
| `LoadMode` | `LoadSceneMode` | `Single` 或 `Additive` |

### `DiceTale.SceneData`（运行时内存数据）

普通 C# 类，保存当前场景的运行时状态。

| 字段 | 类型 | 说明 |
|------|------|------|
| `CurrentScene` | `Scene` | 当前激活的场景预设 |
| `LoadingScene` | `Scene` | 正在加载的场景预设 |
| `Progress` | `float` | 加载进度，范围 `[0, 1]` |
| `IsLoading` | `bool` | 是否正在加载 |

### `DiceTale.SceneManager`（场景管理器）

单例 MonoBehaviour，跨场景存活（`DontDestroyOnLoad`）。

| 成员 | 说明 |
|------|------|
| `Instance` | 单例访问点 |
| `RuntimeData` | 当前运行时场景数据 |
| `LoadScene(Scene scene)` | 异步加载指定场景（Single 模式） |
| `LoadSceneAdditive(Scene scene)` | 异步叠加加载指定场景 |
| `UnloadScene(Scene scene)` | 异步卸载指定场景 |
| `OnSceneLoadStarted` | 开始加载事件 |
| `OnSceneLoadProgressChanged` | 进度变化事件 |
| `OnSceneLoadCompleted` | 加载完成事件 |

## 数据流

```
调用方
  │
  ▼
SceneManager.LoadScene(Scene)
  │
  ├── 更新 SceneData.LoadingScene / IsLoading
  ├── 触发 OnSceneLoadStarted
  ├── 异步加载 Unity 场景
  │       └── 持续更新 SceneData.Progress
  │       └── 持续触发 OnSceneLoadProgressChanged
  │
  └── 加载完成后
          ├── 更新 SceneData.CurrentScene
          ├── 重置 SceneData.LoadingScene / Progress / IsLoading
          └── 触发 OnSceneLoadCompleted
```

## 使用示例

```csharp
using UnityEngine;

namespace DiceTale
{
    public class MainMenu : MonoBehaviour
    {
        [SerializeField] private Scene gameplayScene;

        private void Start()
        {
            SceneManager.Instance.OnSceneLoadProgressChanged += progress =>
                Debug.Log($"Loading progress: {progress:P0}");

            SceneManager.Instance.OnSceneLoadCompleted += scene =>
                Debug.Log($"Loaded: {scene.DisplayName}");
        }

        public void OnStartGameClicked()
        {
            SceneManager.Instance.LoadScene(gameplayScene);
        }
    }
}
```

## 后续可扩展点

1. **过渡动画**：在 `SceneManager` 中增加 `ISceneTransition` 接口，加载前后播放淡入淡出。
2. **场景栈**：增加 `PushScene` / `PopScene`，支持返回上一个场景。
3. **持久化**：将 `SceneData` 中的关键状态写入 `PlayerPrefs` 或文件，支持断点续玩。
4. **资源预加载**：在 `Scene` 预设中增加 `PreloadAssets` 列表，加载场景前预加载资源。

## 约束

- 不使用子目录，所有脚本放在 `Assets/DiceTale/Scripts/` 下。
- 不引入 UI 转场、场景栈、持久化等 Demo 阶段不需要的功能。
- 所有公共类型均放在 `DiceTale` 命名空间下。
