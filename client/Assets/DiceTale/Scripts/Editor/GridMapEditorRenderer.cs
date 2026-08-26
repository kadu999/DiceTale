using UnityEditor;
using UnityEngine;

namespace DiceTale.Editor
{
    public class GridMapEditorRenderer
    {
        public void DrawToolbar(GridMapEditorState state, out bool shouldLoadTexture, out bool shouldSave, out bool shouldLoad, out bool shouldClear, out bool shouldCalculateGridSize)
        {
            shouldLoadTexture = false;
            shouldSave = false;
            shouldLoad = false;
            shouldClear = false;
            shouldCalculateGridSize = false;

            var hasMapName = !string.IsNullOrEmpty(state.MapName);

            EditorGUILayout.BeginHorizontal(EditorStyles.toolbar);

            if (GUILayout.Button("加载图片", EditorStyles.toolbarButton, GUILayout.Width(80f)))
            {
                shouldLoadTexture = true;
            }

            EditorGUI.BeginDisabledGroup(!hasMapName);
            if (GUILayout.Button("Save", EditorStyles.toolbarButton, GUILayout.Width(60f)))
            {
                shouldSave = true;
            }

            if (GUILayout.Button("Load", EditorStyles.toolbarButton, GUILayout.Width(60f)))
            {
                shouldLoad = true;
            }
            EditorGUI.EndDisabledGroup();

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
                shouldCalculateGridSize = true;
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
            EditorGUILayout.LabelField($"Map: {(string.IsNullOrEmpty(state.MapName) ? "-" : state.MapName)}");
            EditorGUILayout.LabelField($"Grid Size: {state.GridSize.x} x {state.GridSize.y}");
            EditorGUILayout.LabelField($"Cell Size: {state.CellSize:F2}");
            EditorGUILayout.Space();
        }

        public Vector2 DrawGrid(GridMapEditorState state, Vector2 scrollPosition, Vector2 windowSize, out Rect gridRect)
        {
            var totalWidth = state.GridSize.x * GridMapEditorConstants.CellDisplaySize;
            var totalHeight = state.GridSize.y * GridMapEditorConstants.CellDisplaySize;

            var position = EditorGUILayout.BeginScrollView(scrollPosition, GUILayout.Width(windowSize.x), GUILayout.Height(Mathf.Max(windowSize.y - GridMapEditorConstants.ToolbarHeight, 50f)));

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
