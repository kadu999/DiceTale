# GridMapEditorWindow 优化设计文档

## 目标

对 `DiceTale` 的关卡网格编辑器窗口 `GridMapEditorWindow` 进行代码审查与中等规模重构，解决当前可复现 bug、改善可维护性，并补齐常用的编辑器体验。

具体目标：

1. 修复画笔中心偏移、越界绘制等明确 bug。
2. 将窗口拆分为状态层、渲染层、入口层，降低单文件复杂度。
3. 加入 Undo/Redo、`Clear` 二次确认、窗口状态持久化。
4. 统一路径与显示常量，减少硬编码。
5. 保持保存的 JSON 格式与运行时 `GridMap` 兼容。

## 文件变更

所有编辑器脚本放在 `client/Assets/DiceTale/Scripts/Editor/`：

- **新增**：`GridMapEditorState.cs`（可序列化状态与数据操作）
- **新增**：`GridMapEditorRenderer.cs`（IMGUI/Handles 绘制）
- **重写**：`GridMapEditorWindow.cs`（仅保留 OnGUI 事件分发与布局）
- **不动**：`GridMap.cs`、`GridCellType.cs`、`GridMapData`（保证运行时兼容）

## 类设计

### `DiceTale.Editor.GridMapEditorWindow`

`EditorWindow` 入口，只负责创建/获取子模块并在 `OnGUI` 中按顺序调用。

| 成员 | 类型 | 说明 |
|------|------|------|
| `state` | `GridMapEditorState` | 编辑器状态实例 |
| `renderer` | `GridMapEditorRenderer` | 渲染器实例 |
| `OnEnable()` | `void` | 初始化 `state` 与 `renderer`，恢复序列化状态 |
| `OnGUI()` | `void` | 依次调用 `DrawToolbar`、`DrawInfo`、`DrawGrid`、`HandleInput` |

### `DiceTale.Editor.GridMapEditorState`

继承 `ScriptableObject`，保存可序列化状态并封装所有数据修改。

| 成员 | 类型 | 说明 |
|------|------|------|
| `MapName` | `string` | 地图名，用于图片与数据文件名 |
| `GridSize` | `Vector2Int` | 网格尺寸 |
| `CellSize` | `float` | 单格世界尺寸 |
| `AutoCellSize` | `bool` | 是否根据参考图自动计算 `CellSize` |
| `SelectedType` | `GridCellType` | 当前画笔类型 |
| `BrushSize` | `int` | 画笔尺寸 `[1, 5]` |
| `EraseMode` | `bool` | 橡皮擦模式 |
| `ReferenceTexture` | `Texture2D` | 参考底图（不序列化） |
| `CellTypes` | `Dictionary<Vector2Int, GridCellType>` | 非空格子数据 |
| `Paint(Vector2Int center)` | `void` | 以中心点按画笔大小绘制 |
| `Erase(Vector2Int center)` | `void` | 以中心点按画笔大小擦除 |
| `Clear()` | `void` | 清空所有格子 |
| `SaveData()` | `void` | 序列化为 JSON 并写入 `DiceTale/Resources` |
| `LoadData()` | `void` | 从 JSON 反序列化 |
| `LoadReferenceTexture()` | `void` | 根据 `MapName` 加载底图 |

### `DiceTale.Editor.GridMapEditorRenderer`

纯绘制类，只读访问 `GridMapEditorState`。

| 成员 | 类型 | 说明 |
|------|------|------|
| `DrawToolbar(GridMapEditorState state)` | `void` | 绘制工具栏与参数面板 |
| `DrawInfo(GridMapEditorState state)` | `void` | 绘制尺寸信息 |
| `DrawGrid(GridMapEditorState state, Vector2 scrollPosition, out Rect gridRect)` | `Vector2` | 绘制网格与背景，返回新的 `scrollPosition` |
| `TryGetGridPos(Rect gridRect, Vector2 mousePos, out Vector2Int gridPos)` | `bool` | 鼠标位置转网格坐标 |

## 数据流

```
用户点击 GridMapEditorWindow
        │
        ▼
GridMapEditorWindow.HandleInput()
        │
        ├── 调用 renderer.TryGetGridPos(...) 计算网格坐标
        │
        ▼
GridMapEditorState.Paint(...) / Erase(...)
        │
        ├── Undo.RecordObject(state, "Paint Grid")
        ├── 边界校验
        └── 修改 CellTypes
        │
        ▼
GridMapEditorWindow.OnGUI 再次调用 renderer.DrawGrid(state)
        │
        ▼
刷新显示
```

## 关键修复

### 画笔中心

以 `center` 为中心，半径 `radius = (brushSize - 1) / 2`：

```csharp
var radius = (brushSize - 1) / 2;
for (int x = -radius; x <= radius; x++)
{
    for (int y = -radius; y <= radius; y++)
    {
        var pos = center + new Vector2Int(x, y);
        // ...
    }
}
```

保证 `brushSize` 为 1/2/3/4/5 时均中心对称。

### 边界校验

所有写入 `CellTypes` 的坐标必须满足：

```csharp
0 <= pos.x && pos.x < gridSize.x &&
0 <= pos.y && pos.y < gridSize.y
```

越界坐标直接忽略。

### 坐标转换统一

鼠标位置 → 网格坐标、网格坐标 → 显示 Rect 的逻辑抽到 `GridMapEditorRenderer` 的静态辅助方法中，消除 `GetGridPosFromMouse` 与 `GetCellRect` 的重复计算。

### Undo/Redo

数据修改前调用：

```csharp
Undo.RecordObject(state, "Paint Grid");
```

### Clear 确认

调用 `EditorUtility.DisplayDialog` 二次确认后再清空。

## 边界约定

- `GridMapEditorWindow` 不直接修改 `CellTypes`，所有修改走 `GridMapEditorState`。
- `GridMapEditorRenderer` 只读访问 `state`，不修改任何状态。
- `GridMapEditorState` 保持 `GridMapData` 的 JSON 结构与运行时 `GridMap` 兼容。
- `gridSize` 输入非正数时自动钳位到 `Vector2Int.one`。
- `cellSize` 小于等于 0 时自动设为 1。

## 常量与路径

统一提取到 `GridMapEditorConstants`：

```csharp
public static class GridMapEditorConstants
{
    public const float CellDisplaySize = 24f;
    public const string ImageDirectory = "Assets/DiceTale/Res/Textures";
    public const string DataDirectory = "Assets/DiceTale/Resources";
    public const string DataDirectoryFull = "DiceTale/Resources";
}
```

> 注意：项目实际把图片放在 `Assets/DiceTale/Res/Textures`，数据 JSON 放在 `Assets/DiceTale/Resources`。本设计保持现有目录结构不变，仅通过常量统一路径拼接，避免字符串散落在各方法中。

## 使用示例

```csharp
// 在 Unity 菜单打开
[MenuItem("DiceTale/GridMap Editor")]
public static void ShowWindow()
{
    GetWindow<GridMapEditorWindow>("GridMap Editor");
}

// 绘制入口
private void OnGUI()
{
    renderer.DrawToolbar(state);
    renderer.DrawInfo(state);
    scrollPosition = renderer.DrawGrid(state, scrollPosition, out var gridRect);
    HandleInput(gridRect);
}
```

## 测试计划

1. **单元测试（Editor 模式）**
   - 构造 `GridMapEditorState`，调用 `Paint`/`Erase`，断言 `CellTypes` 内容。
   - 测试 `brushSize = 1/2/3/4/5` 时影响的格子数量与中心位置。
   - 测试越界坐标不会写入。
   - 调用 `SaveData` 后读取文件，验证 JSON 结构与 `GridMapData` 兼容。

2. **手动验证**
   - 打开 `DiceTale/GridMap Editor`。
   - 输入地图名，加载图片，验证网格尺寸自动计算。
   - 用不同 `brushSize` 绘制多种格子类型。
   - 使用橡皮擦、Undo、Clear。
   - 保存后运行场景，验证 `GridMap.LoadData` 能正确读取。

## 后续可扩展点

1. **多地图标签页**：在 `GridMapEditorState` 之上增加一个管理多个地图的容器。
2. **图层系统**：支持背景层、障碍层、事件层等独立编辑。
3. **预览模式**：在 Scene 视图中实时预览网格与障碍物。
4. **快捷键**：为常用操作绑定 `MenuItem` 快捷键。
