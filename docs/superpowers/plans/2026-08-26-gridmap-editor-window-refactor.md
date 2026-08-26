# GridMapEditorWindow Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 `GridMapEditorWindow` 重构为状态层、渲染层、窗口入口三层结构，修复画笔中心偏移与越界绘制 bug，加入 Undo/Redo 与 Clear 确认，并保持与运行时 `GridMap` 的 JSON 兼容。

**Architecture:** 用 `GridMapEditorState`（ScriptableObject）封装可序列化状态与数据修改；`GridMapEditorRenderer` 负责纯绘制；`GridMapEditorWindow` 只分发 `OnGUI` 事件。所有路径与显示常量抽到 `GridMapEditorConstants`。

**Tech Stack:** Unity 2022+ / IMGUI / Unity Editor Tests Runner

## Global Constraints

- 所有编辑器脚本放在 `client/Assets/DiceTale/Scripts/Editor/`。
- 保持 `GridMapData` 与 `GridCellType` 的现有结构与值不变，确保运行时 `GridMap.LoadData` 仍可读取。
- 图片目录保持 `Assets/DiceTale/Res/Textures`，数据目录保持 `Assets/DiceTale/Resources`。
- `gridSize` 不允许非正数，输入后自动钳位到 `Vector2Int.one`。
- `cellSize` 小于等于 0 时自动设为 1。
- 数据修改前必须调用 `Undo.RecordObject(state, ...)`。

---

## File Structure

| 文件 | 职责 |
|------|------|
| `GridMapEditorConstants.cs` | 收集所有路径与显示常量 |
| `GridMapEditorState.cs` | 可序列化状态，封装 `Paint`/`Erase`/`Clear`/`Save`/`Load` |
| `GridMapEditorRenderer.cs` | 工具栏、信息、网格、背景图的 IMGUI 绘制 |
| `GridMapEditorWindow.cs` | `EditorWindow` 入口，初始化子模块并分发事件 |
| `Tests/Editor/GridMapEditorStateTests.cs` | Editor 模式单元测试 |

---

### Task 1: Create `GridMapEditorConstants`

**Files:**
- Create: `client/Assets/DiceTale/Scripts/Editor/GridMapEditorConstants.cs`

**Interfaces:**
- Produces: 公共常量 `CellDisplaySize`、`ImageDirectory`、`DataDirectory`、`DataDirectoryFull`。

- [ ] **Step 1: Create the constants file**

```csharp
namespace DiceTale.Editor
{
    public static class GridMapEditorConstants
    {
        public const float CellDisplaySize = 24f;
        public const string ImageDirectory = "Assets/DiceTale/Res/Textures";
        public const string DataDirectory = "Assets/DiceTale/Resources";
        public const string DataDirectoryFull = "DiceTale/Resources";
        public const int MinBrushSize = 1;
        public const int MaxBrushSize = 5;
    }
}
```

- [ ] **Step 2: Verify it compiles**

Open Unity or run assembly compilation. Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add client/Assets/DiceTale/Scripts/Editor/GridMapEditorConstants.cs
git commit -m "feat(editor): add GridMapEditorConstants for shared paths and display constants"
```

---

### Task 2: Create `GridMapEditorState`

**Files:**
- Create: `client/Assets/DiceTale/Scripts/Editor/GridMapEditorState.cs`

**Interfaces:**
- Consumes: `GridMapEditorConstants`（路径常量）、`GridMapData`、`GridCellType`。
- Produces:
  - Properties: `MapName`, `GridSize`, `CellSize`, `AutoCellSize`, `SelectedType`, `BrushSize`, `EraseMode`, `ReferenceTexture`, `CellTypes`。
  - Methods: `Paint(Vector2Int center)`, `Erase(Vector2Int center)`, `Clear()`, `SaveData()`, `LoadData()`, `LoadReferenceTexture()`, `CalculateGridSizeFromImage()`。

- [ ] **Step 1: Write the failing test**

Create `client/Assets/DiceTale/Scripts/Editor/Tests/GridMapEditorStateTests.cs`:

```csharp
using System.Collections.Generic;
using NUnit.Framework;
using UnityEngine;

namespace DiceTale.Editor.Tests
{
    public class GridMapEditorStateTests
    {
        [Test]
        public void Paint_WithBrushSize1_PaintsSingleCenterCell()
        {
            var state = ScriptableObject.CreateInstance<GridMapEditorState>();
            state.GridSize = new Vector2Int(5, 5);
            state.BrushSize = 1;
            state.SelectedType = GridCellType.Obstacle;

            state.Paint(new Vector2Int(2, 2));

            Assert.AreEqual(1, state.CellTypes.Count);
            Assert.IsTrue(state.CellTypes.ContainsKey(new Vector2Int(2, 2)));
            Assert.AreEqual(GridCellType.Obstacle, state.CellTypes[new Vector2Int(2, 2)]);
        }
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run in Unity Test Runner: `GridMapEditorStateTests.Paint_WithBrushSize1_PaintsSingleCenterCell`.
Expected: FAIL because `GridMapEditorState` does not exist.

- [ ] **Step 3: Implement `GridMapEditorState`**

Create `client/Assets/DiceTale/Scripts/Editor/GridMapEditorState.cs`:

```csharp
using System.Collections.Generic;
using System.IO;
using UnityEditor;
using UnityEngine;

namespace DiceTale.Editor
{
    public class GridMapEditorState : ScriptableObject
    {
        [SerializeField] private string mapName = "";
        [SerializeField] private Vector2Int gridSize = new Vector2Int(20, 20);
        [SerializeField] private float cellSize = 1f;
        [SerializeField] private bool autoCellSize = true;
        [SerializeField] private GridCellType selectedType = GridCellType.Obstacle;
        [SerializeField] private int brushSize = 1;
        [SerializeField] private bool eraseMode;

        private Dictionary<Vector2Int, GridCellType> cellTypes = new Dictionary<Vector2Int, GridCellType>();

        public string MapName { get => mapName; set => mapName = value; }
        public Vector2Int GridSize { get => gridSize; set => gridSize = Vector2Int.Max(value, Vector2Int.one); }
        public float CellSize { get => cellSize; set => cellSize = value > 0f ? value : 1f; }
        public bool AutoCellSize { get => autoCellSize; set => autoCellSize = value; }
        public GridCellType SelectedType { get => selectedType; set => selectedType = value; }
        public int BrushSize { get => brushSize; set => brushSize = Mathf.Clamp(value, GridMapEditorConstants.MinBrushSize, GridMapEditorConstants.MaxBrushSize); }
        public bool EraseMode { get => eraseMode; set => eraseMode = value; }
        public Texture2D ReferenceTexture { get; set; }
        public IReadOnlyDictionary<Vector2Int, GridCellType> CellTypes => cellTypes;

        public void Paint(Vector2Int center)
        {
            Undo.RecordObject(this, "Paint Grid");
            ApplyBrush(center, selectedType);
        }

        public void Erase(Vector2Int center)
        {
            Undo.RecordObject(this, "Erase Grid");
            ApplyBrush(center, GridCellType.Empty);
        }

        private void ApplyBrush(Vector2Int center, GridCellType type)
        {
            var radius = (brushSize - 1) / 2;
            for (int x = -radius; x <= radius; x++)
            {
                for (int y = -radius; y <= radius; y++)
                {
                    var pos = new Vector2Int(center.x + x, center.y + y);
                    if (!IsInsideGrid(pos))
                    {
                        continue;
                    }

                    if (type == GridCellType.Empty)
                    {
                        cellTypes.Remove(pos);
                    }
                    else
                    {
                        cellTypes[pos] = type;
                    }
                }
            }
        }

        public void Clear()
        {
            Undo.RecordObject(this, "Clear Grid");
            cellTypes.Clear();
        }

        public void SaveData()
        {
            if (string.IsNullOrEmpty(mapName))
            {
                Debug.LogWarning("地图名不能为空");
                return;
            }

            var data = new GridMapData
            {
                gridSizeX = gridSize.x,
                gridSizeY = gridSize.y
            };

            foreach (var pair in cellTypes)
            {
                if (pair.Value == GridCellType.Empty)
                {
                    continue;
                }

                data.cells.Add(new GridCellData
                {
                    x = pair.Key.x,
                    y = pair.Key.y,
                    type = (int)pair.Value
                });
            }

            var json = JsonUtility.ToJson(data, true);
            var directory = Path.Combine(Application.dataPath, GridMapEditorConstants.DataDirectoryFull);
            if (!Directory.Exists(directory))
            {
                Directory.CreateDirectory(directory);
            }

            var path = Path.Combine(directory, $"{mapName}.json");
            File.WriteAllText(path, json);
            AssetDatabase.Refresh();
            Debug.Log($"地图数据已保存: {path}");
        }

        public void LoadData()
        {
            cellTypes.Clear();

            if (string.IsNullOrEmpty(mapName))
            {
                return;
            }

            var path = Path.Combine(Application.dataPath, $"{GridMapEditorConstants.DataDirectoryFull}/{mapName}.json");
            if (!File.Exists(path))
            {
                return;
            }

            var json = File.ReadAllText(path);
            var data = JsonUtility.FromJson<GridMapData>(json);
            if (data?.cells == null)
            {
                return;
            }

            gridSize = Vector2Int.Max(new Vector2Int(data.gridSizeX, data.gridSizeY), Vector2Int.one);
            foreach (var cell in data.cells)
            {
                var pos = new Vector2Int(cell.x, cell.y);
                if (IsInsideGrid(pos))
                {
                    cellTypes[pos] = (GridCellType)cell.type;
                }
            }
        }

        public void LoadReferenceTexture()
        {
            ReferenceTexture = null;
            CellSize = 1f;

            if (string.IsNullOrEmpty(mapName))
            {
                return;
            }

            var path = Path.Combine(GridMapEditorConstants.ImageDirectory, $"{mapName}.png");
            ReferenceTexture = AssetDatabase.LoadAssetAtPath<Texture2D>(path);

            if (ReferenceTexture == null)
            {
                Debug.LogWarning($"图片未找到: {path}");
                return;
            }

            CalculateGridSizeFromImage();
            LoadData();
        }

        public void CalculateGridSizeFromImage()
        {
            if (ReferenceTexture == null)
            {
                return;
            }

            if (cellSize <= 0f)
            {
                CellSize = 1f;
            }

            gridSize = new Vector2Int(
                Mathf.RoundToInt(ReferenceTexture.width / cellSize),
                Mathf.RoundToInt(ReferenceTexture.height / cellSize)
            );
        }

        private bool IsInsideGrid(Vector2Int pos)
        {
            return pos.x >= 0 && pos.x < gridSize.x && pos.y >= 0 && pos.y < gridSize.y;
        }
    }
}
```

- [ ] **Step 4: Run the test**

Expected: PASS.

- [ ] **Step 5: Add brush-size and bounds tests**

Append to the test file:

```csharp
        [Test]
        public void Paint_WithBrushSize3_Paints3x3CenteredCells()
        {
            var state = ScriptableObject.CreateInstance<GridMapEditorState>();
            state.GridSize = new Vector2Int(10, 10);
            state.BrushSize = 3;
            state.SelectedType = GridCellType.Obstacle;

            state.Paint(new Vector2Int(5, 5));

            Assert.AreEqual(9, state.CellTypes.Count);
            for (int x = 4; x <= 6; x++)
            {
                for (int y = 4; y <= 6; y++)
                {
                    Assert.IsTrue(state.CellTypes.ContainsKey(new Vector2Int(x, y)));
                }
            }
        }

        [Test]
        public void Paint_OutOfBounds_IsIgnored()
        {
            var state = ScriptableObject.CreateInstance<GridMapEditorState>();
            state.GridSize = new Vector2Int(5, 5);
            state.BrushSize = 1;
            state.SelectedType = GridCellType.Obstacle;

            state.Paint(new Vector2Int(-1, -1));

            Assert.AreEqual(0, state.CellTypes.Count);
        }

        [Test]
        public void Erase_RemovesCells()
        {
            var state = ScriptableObject.CreateInstance<GridMapEditorState>();
            state.GridSize = new Vector2Int(5, 5);
            state.BrushSize = 1;
            state.SelectedType = GridCellType.Obstacle;
            state.Paint(new Vector2Int(2, 2));

            state.Erase(new Vector2Int(2, 2));

            Assert.AreEqual(0, state.CellTypes.Count);
        }
```

- [ ] **Step 6: Run all tests**

Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git add client/Assets/DiceTale/Scripts/Editor/GridMapEditorState.cs
git add client/Assets/DiceTale/Scripts/Editor/Tests/GridMapEditorStateTests.cs
git commit -m "feat(editor): add GridMapEditorState with undo, bounds checks, and brush fix"
```

---

### Task 3: Create `GridMapEditorRenderer`

**Files:**
- Create: `client/Assets/DiceTale/Scripts/Editor/GridMapEditorRenderer.cs`

**Interfaces:**
- Consumes: `GridMapEditorState`、`GridMapEditorConstants`。
- Produces:
  - `void DrawToolbar(GridMapEditorState state, out bool shouldLoadTexture, out bool shouldSave, out bool shouldLoad, out bool shouldClear)`
  - `void DrawInfo(GridMapEditorState state)`
  - `Vector2 DrawGrid(GridMapEditorState state, Vector2 scrollPosition, out Rect gridRect)`
  - `static bool TryGetGridPos(Rect gridRect, Vector2 mousePos, Vector2Int gridSize, out Vector2Int gridPos)`

- [ ] **Step 1: Implement the renderer**

Create `client/Assets/DiceTale/Scripts/Editor/GridMapEditorRenderer.cs`:

```csharp
using UnityEditor;
using UnityEngine;

namespace DiceTale.Editor
{
    public class GridMapEditorRenderer
    {
        private const float ToolbarHeight = 160f;

        public void DrawToolbar(GridMapEditorState state, out bool shouldLoadTexture, out bool shouldSave, out bool shouldLoad, out bool shouldClear)
        {
            shouldLoadTexture = false;
            shouldSave = false;
            shouldLoad = false;
            shouldClear = false;

            EditorGUILayout.BeginHorizontal(EditorStyles.toolbar);

            EditorGUILayout.LabelField("地图名", GUILayout.Width(45f));
            state.MapName = EditorGUILayout.TextField(state.MapName, GUILayout.Width(120f));

            if (GUILayout.Button("加载图片", EditorStyles.toolbarButton, GUILayout.Width(80f)))
            {
                shouldLoadTexture = true;
            }

            if (GUILayout.Button("Save", EditorStyles.toolbarButton, GUILayout.Width(60f)))
            {
                shouldSave = true;
            }

            if (GUILayout.Button("Load", EditorStyles.toolbarButton, GUILayout.Width(60f)))
            {
                shouldLoad = true;
            }

            if (GUILayout.Button("Clear", EditorStyles.toolbarButton, GUILayout.Width(60f)))
            {
                shouldClear = true;
            }

            EditorGUILayout.EndHorizontal();

            EditorGUILayout.Space();

            EditorGUILayout.BeginHorizontal();
            state.GridSize = EditorGUILayout.Vector2IntField("网格大小", state.GridSize);
            if (GUILayout.Button("根据图片计算", GUILayout.Width(100f)))
            {
                state.CalculateGridSizeFromImage();
            }
            EditorGUILayout.EndHorizontal();

            EditorGUILayout.BeginHorizontal();
            state.AutoCellSize = EditorGUILayout.Toggle("自动格子大小", state.AutoCellSize);
            if (!state.AutoCellSize)
            {
                state.CellSize = EditorGUILayout.FloatField("格子大小", state.CellSize);
            }
            else if (state.ReferenceTexture != null)
            {
                EditorGUI.BeginDisabledGroup(true);
                EditorGUILayout.FloatField("格子大小", state.CellSize);
                EditorGUI.EndDisabledGroup();
            }
            EditorGUILayout.EndHorizontal();

            EditorGUILayout.BeginHorizontal();
            state.SelectedType = (GridCellType)EditorGUILayout.EnumPopup("画笔类型", state.SelectedType);
            state.BrushSize = EditorGUILayout.IntSlider("画笔大小", state.BrushSize, GridMapEditorConstants.MinBrushSize, GridMapEditorConstants.MaxBrushSize);
            EditorGUILayout.EndHorizontal();

            state.EraseMode = EditorGUILayout.Toggle("橡皮擦模式", state.EraseMode);
        }

        public void DrawInfo(GridMapEditorState state)
        {
            EditorGUILayout.LabelField($"Grid Size: {state.GridSize.x} x {state.GridSize.y}");
            EditorGUILayout.LabelField($"Cell Size: {state.CellSize:F2}");
            EditorGUILayout.Space();
        }

        public Vector2 DrawGrid(GridMapEditorState state, Vector2 scrollPosition, Vector2 windowSize, out Rect gridRect)
        {
            var totalWidth = state.GridSize.x * GridMapEditorConstants.CellDisplaySize;
            var totalHeight = state.GridSize.y * GridMapEditorConstants.CellDisplaySize;

            var position = EditorGUILayout.BeginScrollView(scrollPosition, GUILayout.Width(windowSize.x), GUILayout.Height(windowSize.y - ToolbarHeight));

            gridRect = GUILayoutUtility.GetRect(totalWidth, totalHeight);
            DrawBackground(gridRect, state);
            DrawCells(gridRect, state);
            DrawGridLines(gridRect, state);

            EditorGUILayout.EndScrollView();
            return position;
        }

        private void DrawBackground(Rect gridRect, GridMapEditorState state)
        {
            if (state.ReferenceTexture != null)
            {
                GUI.DrawTexture(gridRect, state.ReferenceTexture, ScaleMode.StretchToFill);
            }
            else
            {
                EditorGUI.DrawRect(gridRect, new Color(0.2f, 0.2f, 0.2f, 1f));
            }
        }

        private void DrawCells(Rect gridRect, GridMapEditorState state)
        {
            foreach (var pair in state.CellTypes)
            {
                var rect = GetCellRect(gridRect, state.GridSize, pair.Key);
                EditorGUI.DrawRect(rect, GetCellColor(pair.Value));
            }
        }

        private void DrawGridLines(Rect gridRect, GridMapEditorState state)
        {
            Handles.color = new Color(1f, 1f, 1f, 0.3f);

            for (int x = 0; x <= state.GridSize.x; x++)
            {
                var xPos = gridRect.x + x * GridMapEditorConstants.CellDisplaySize;
                Handles.DrawLine(new Vector3(xPos, gridRect.y), new Vector3(xPos, gridRect.yMax));
            }

            for (int y = 0; y <= state.GridSize.y; y++)
            {
                var yPos = gridRect.y + y * GridMapEditorConstants.CellDisplaySize;
                Handles.DrawLine(new Vector3(gridRect.x, yPos), new Vector3(gridRect.xMax, yPos));
            }
        }

        public static bool TryGetGridPos(Rect gridRect, Vector2 mousePos, Vector2Int gridSize, out Vector2Int gridPos)
        {
            gridPos = default;
            if (!gridRect.Contains(mousePos))
            {
                return false;
            }

            var localX = mousePos.x - gridRect.x;
            var localY = mousePos.y - gridRect.y;
            var x = Mathf.FloorToInt(localX / GridMapEditorConstants.CellDisplaySize);
            var y = gridSize.y - 1 - Mathf.FloorToInt(localY / GridMapEditorConstants.CellDisplaySize);

            gridPos = new Vector2Int(x, y);
            return gridPos.x >= 0 && gridPos.x < gridSize.x && gridPos.y >= 0 && gridPos.y < gridSize.y;
        }

        private static Rect GetCellRect(Rect gridRect, Vector2Int gridSize, Vector2Int gridPos)
        {
            var x = gridRect.x + gridPos.x * GridMapEditorConstants.CellDisplaySize;
            var y = gridRect.y + (gridSize.y - 1 - gridPos.y) * GridMapEditorConstants.CellDisplaySize;
            return new Rect(x, y, GridMapEditorConstants.CellDisplaySize, GridMapEditorConstants.CellDisplaySize);
        }

        private static Color GetCellColor(GridCellType type)
        {
            switch (type)
            {
                case GridCellType.Obstacle:
                    return new Color(1f, 0f, 0f, 0.6f);
                case GridCellType.Difficult:
                    return new Color(1f, 0.5f, 0f, 0.6f);
                case GridCellType.Water:
                    return new Color(0f, 0.5f, 1f, 0.6f);
                default:
                    return Color.clear;
            }
        }
    }
}
```

- [ ] **Step 2: Verify compilation**

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add client/Assets/DiceTale/Scripts/Editor/GridMapEditorRenderer.cs
git commit -m "feat(editor): add GridMapEditorRenderer for toolbar and grid rendering"
```

---

### Task 4: Rewrite `GridMapEditorWindow`

**Files:**
- Modify: `client/Assets/DiceTale/Scripts/Editor/GridMapEditorWindow.cs`

**Interfaces:**
- Consumes: `GridMapEditorState`, `GridMapEditorRenderer`, `GridMapEditorConstants`.
- Produces: `EditorWindow` 入口，菜单项 `DiceTale/GridMap Editor`。

- [ ] **Step 1: Replace the entire file**

```csharp
using UnityEditor;
using UnityEngine;

namespace DiceTale.Editor
{
    public class GridMapEditorWindow : EditorWindow
    {
        private GridMapEditorState state;
        private GridMapEditorRenderer renderer;
        private Vector2 scrollPosition;

        [MenuItem("DiceTale/GridMap Editor")]
        public static void ShowWindow()
        {
            GetWindow<GridMapEditorWindow>("GridMap Editor");
        }

        private void OnEnable()
        {
            renderer = new GridMapEditorRenderer();
            state = CreateInstance<GridMapEditorState>();
            state.hideFlags = HideFlags.HideAndDontSave;
        }

        private void OnGUI()
        {
            renderer.DrawToolbar(state, out var shouldLoadTexture, out var shouldSave, out var shouldLoad, out var shouldClear);
            renderer.DrawInfo(state);
            scrollPosition = renderer.DrawGrid(state, scrollPosition, position.size, out var gridRect);

            if (shouldLoadTexture)
            {
                state.LoadReferenceTexture();
            }
            if (shouldSave)
            {
                state.SaveData();
            }
            if (shouldLoad)
            {
                state.LoadData();
            }
            if (shouldClear)
            {
                if (EditorUtility.DisplayDialog("确认清空", "确定要清空所有格子吗？", "确定", "取消"))
                {
                    state.Clear();
                }
            }

            HandleInput(gridRect);
        }

        private void HandleInput(Rect gridRect)
        {
            var e = Event.current;
            if (e == null)
            {
                return;
            }

            if (e.type != EventType.MouseDown && e.type != EventType.MouseDrag)
            {
                return;
            }

            if (!GridMapEditorRenderer.TryGetGridPos(gridRect, e.mousePosition, state.GridSize, out var gridPos))
            {
                return;
            }

            if (e.button == 0)
            {
                if (state.EraseMode)
                {
                    state.Erase(gridPos);
                }
                else
                {
                    state.Paint(gridPos);
                }
                e.Use();
            }
        }
    }
}
```

- [ ] **Step 2: Verify compilation and open the window**

In Unity, open `DiceTale/GridMap Editor`. Expected: window opens without errors.

- [ ] **Step 3: Commit**

```bash
git add client/Assets/DiceTale/Scripts/Editor/GridMapEditorWindow.cs
git commit -m "refactor(editor): split GridMapEditorWindow into state, renderer, and window"
```

---

### Task 5: Persistence and Window State Recovery

**Files:**
- Modify: `client/Assets/DiceTale/Scripts/Editor/GridMapEditorWindow.cs`

**Interfaces:**
- Produces: `GridMapEditorWindow` re-creates `state` from serialized fields on domain reload.

- [ ] **Step 1: Add serialized fields to the window**

Add to `GridMapEditorWindow`:

```csharp
[SerializeField] private string serializedMapName = "";
[SerializeField] private Vector2Int serializedGridSize = new Vector2Int(20, 20);
[SerializeField] private float serializedCellSize = 1f;
[SerializeField] private bool serializedAutoCellSize = true;
[SerializeField] private GridCellType serializedSelectedType = GridCellType.Obstacle;
[SerializeField] private int serializedBrushSize = 1;
[SerializeField] private bool serializedEraseMode;
```

- [ ] **Step 2: Sync state before domain reload and after**

Implement `OnDisable` to push state into serialized fields, and `OnEnable` to pull them back:

```csharp
private void OnEnable()
{
    renderer = new GridMapEditorRenderer();
    state = CreateInstance<GridMapEditorState>();
    state.hideFlags = HideFlags.HideAndDontSave;

    state.MapName = serializedMapName;
    state.GridSize = serializedGridSize;
    state.CellSize = serializedCellSize;
    state.AutoCellSize = serializedAutoCellSize;
    state.SelectedType = serializedSelectedType;
    state.BrushSize = serializedBrushSize;
    state.EraseMode = serializedEraseMode;
}

private void OnDisable()
{
    if (state == null)
    {
        return;
    }

    serializedMapName = state.MapName;
    serializedGridSize = state.GridSize;
    serializedCellSize = state.CellSize;
    serializedAutoCellSize = state.AutoCellSize;
    serializedSelectedType = state.SelectedType;
    serializedBrushSize = state.BrushSize;
    serializedEraseMode = state.EraseMode;
}
```

- [ ] **Step 3: Verify persistence**

Open the window, change map name and grid size, trigger a domain reload (e.g. recompile a script). Expected: values are restored.

- [ ] **Step 4: Commit**

```bash
git add client/Assets/DiceTale/Scripts/Editor/GridMapEditorWindow.cs
git commit -m "feat(editor): persist GridMapEditorWindow state across domain reloads"
```

---

### Task 6: Save/Load Compatibility Test

**Files:**
- Modify: `client/Assets/DiceTale/Scripts/Editor/Tests/GridMapEditorStateTests.cs`

**Interfaces:**
- Consumes: `GridMapEditorState.SaveData`/`LoadData`, `GridMap`, `GridMapData`.

- [ ] **Step 1: Add JSON compatibility test**

Append to test file:

```csharp
        [Test]
        public void SaveData_AndRuntimeGridMap_LoadData_Match()
        {
            var state = ScriptableObject.CreateInstance<GridMapEditorState>();
            state.MapName = "TestMap";
            state.GridSize = new Vector2Int(5, 5);
            state.BrushSize = 1;
            state.SelectedType = GridCellType.Difficult;
            state.Paint(new Vector2Int(1, 1));
            state.SelectedType = GridCellType.Water;
            state.Paint(new Vector2Int(2, 2));

            state.SaveData();

            var go = new GameObject("TestMap");
            var gridMap = go.AddComponent<GridMap>();
            gridMap.LoadData("TestMap");

            Assert.AreEqual(GridCellType.Difficult, gridMap.GetCellType(new Vector2Int(1, 1)));
            Assert.AreEqual(GridCellType.Water, gridMap.GetCellType(new Vector2Int(2, 2)));
            Assert.AreEqual(GridCellType.Empty, gridMap.GetCellType(new Vector2Int(0, 0)));

            Object.DestroyImmediate(go);

            var path = System.IO.Path.Combine(UnityEngine.Application.dataPath, "DiceTale/Resources/TestMap.json");
            if (System.IO.File.Exists(path))
            {
                System.IO.File.Delete(path);
            }
        }
```

- [ ] **Step 2: Run the test**

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add client/Assets/DiceTale/Scripts/Editor/Tests/GridMapEditorStateTests.cs
git commit -m "test(editor): add save/load compatibility test with runtime GridMap"
```

---

## Self-Review

**Spec coverage:**
- 修复画笔中心偏移 → Task 2 `ApplyBrush` 使用 `(brushSize - 1) / 2`。
- 越界绘制 → Task 2 `IsInsideGrid`。
- 拆分三层 → Task 2/3/4。
- Undo/Redo → Task 2 `Undo.RecordObject`。
- Clear 确认 → Task 4 `EditorUtility.DisplayDialog`。
- 状态持久化 → Task 5 序列化字段。
- 统一常量 → Task 1。
- JSON 兼容 → Task 6 测试。

**Placeholder scan:**
- 无 "TBD" / "TODO" / "implement later"。
- 无 "Add appropriate error handling" 等模糊描述。
- 所有代码步骤都包含实际代码。

**Type consistency:**
- `DrawGrid` 签名在 Task 3 Step 2 修正为接收 `Vector2 windowSize`。
- `GridMapEditorState` 的属性与方法在各任务中名称一致。

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-08-26-gridmap-editor-window-refactor.md`.**

Two execution options:

1. **Subagent-Driven (recommended)** - Dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** - Execute tasks in this session using `executing-plans`, batch execution with checkpoints.

Because the session is in auto permission mode, I will proceed with **Subagent-Driven** execution unless you specify otherwise.
