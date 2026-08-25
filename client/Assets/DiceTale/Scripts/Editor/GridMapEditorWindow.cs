using System.Collections.Generic;
using UnityEditor;
using UnityEngine;

namespace DiceTale.Editor
{
    public class GridMapEditorWindow : EditorWindow
    {
        private const float CellDisplaySize = 24f;

        private GridMap gridMap;
        private Texture2D referenceTexture;
        private GridCellType selectedType = GridCellType.Obstacle;
        private int brushSize = 1;
        private Vector2 scrollPosition;
        private bool eraseMode;
        private Rect lastGridRect;

        [MenuItem("DiceTale/GridMap Editor")]
        public static void ShowWindow()
        {
            GetWindow<GridMapEditorWindow>("GridMap Editor");
        }

        public static void Open(GridMap target)
        {
            var window = GetWindow<GridMapEditorWindow>("GridMap Editor");
            window.gridMap = target;
            window.LoadReferenceTexture();
            window.Show();
        }

        private void OnGUI()
        {
            DrawToolbar();

            if (gridMap == null)
            {
                EditorGUILayout.HelpBox("请在 Hierarchy 中选择一个带有 GridMap 的物体，或点击 Inspector 里的 Open Grid Editor", MessageType.Info);
                return;
            }

            DrawInfo();
            DrawGrid();
            HandleInput();
        }

        private void DrawToolbar()
        {
            EditorGUILayout.BeginHorizontal(EditorStyles.toolbar);

            gridMap = EditorGUILayout.ObjectField(gridMap, typeof(GridMap), true, GUILayout.Width(200f)) as GridMap;

            if (GUILayout.Button("刷新贴图", EditorStyles.toolbarButton, GUILayout.Width(80f)))
            {
                LoadReferenceTexture();
            }

            if (GUILayout.Button("Save", EditorStyles.toolbarButton, GUILayout.Width(60f)))
            {
                gridMap?.SaveData();
            }

            if (GUILayout.Button("Load", EditorStyles.toolbarButton, GUILayout.Width(60f)))
            {
                gridMap?.LoadData();
            }

            if (GUILayout.Button("Clear", EditorStyles.toolbarButton, GUILayout.Width(60f)))
            {
                ClearAll();
            }

            EditorGUILayout.EndHorizontal();

            EditorGUILayout.Space();

            EditorGUILayout.BeginHorizontal();
            selectedType = (GridCellType)EditorGUILayout.EnumPopup("画笔类型", selectedType);
            brushSize = EditorGUILayout.IntSlider("画笔大小", brushSize, 1, 5);
            EditorGUILayout.EndHorizontal();

            eraseMode = EditorGUILayout.Toggle("橡皮擦模式", eraseMode);
        }

        private void DrawInfo()
        {
            EditorGUILayout.LabelField($"Grid Size: {gridMap.GridSize.x} x {gridMap.GridSize.y}");
            EditorGUILayout.LabelField($"Cell Size: {gridMap.CellSize:F2}");
            EditorGUILayout.Space();
        }

        private void DrawGrid()
        {
            var size = gridMap.GridSize;
            var totalWidth = size.x * CellDisplaySize;
            var totalHeight = size.y * CellDisplaySize;

            scrollPosition = EditorGUILayout.BeginScrollView(scrollPosition, GUILayout.Width(position.width), GUILayout.Height(position.height - 120f));

            lastGridRect = GUILayoutUtility.GetRect(totalWidth, totalHeight);
            DrawBackground(lastGridRect);
            DrawCells(lastGridRect);
            DrawGridLines(lastGridRect);

            EditorGUILayout.EndScrollView();
        }

        private void DrawBackground(Rect gridRect)
        {
            if (referenceTexture != null)
            {
                GUI.DrawTexture(gridRect, referenceTexture, ScaleMode.StretchToFill);
            }
            else
            {
                EditorGUI.DrawRect(gridRect, new Color(0.2f, 0.2f, 0.2f, 1f));
            }
        }

        private void DrawCells(Rect gridRect)
        {
            var cellTypes = gridMap.GetCellTypes();
            foreach (var pair in cellTypes)
            {
                var rect = GetCellRect(gridRect, pair.Key);
                EditorGUI.DrawRect(rect, GetCellColor(pair.Value));
            }
        }

        private void DrawGridLines(Rect gridRect)
        {
            var size = gridMap.GridSize;
            Handles.color = new Color(1f, 1f, 1f, 0.3f);

            for (int x = 0; x <= size.x; x++)
            {
                var xPos = gridRect.x + x * CellDisplaySize;
                Handles.DrawLine(new Vector3(xPos, gridRect.y), new Vector3(xPos, gridRect.yMax));
            }

            for (int y = 0; y <= size.y; y++)
            {
                var yPos = gridRect.y + y * CellDisplaySize;
                Handles.DrawLine(new Vector3(gridRect.x, yPos), new Vector3(gridRect.xMax, yPos));
            }
        }

        private void HandleInput()
        {
            var e = Event.current;
            if (e == null || gridMap == null)
            {
                return;
            }

            if (e.type == EventType.MouseDown || e.type == EventType.MouseDrag)
            {
                if (!lastGridRect.Contains(e.mousePosition))
                {
                    return;
                }

                var gridPos = GetGridPosFromMouse(lastGridRect, e.mousePosition);
                if (e.button == 0)
                {
                    Paint(gridPos);
                    e.Use();
                }
            }
        }

        private Vector2Int GetGridPosFromMouse(Rect gridRect, Vector2 mousePos)
        {
            var localX = mousePos.x - gridRect.x;
            var localY = mousePos.y - gridRect.y;
            var x = Mathf.FloorToInt(localX / CellDisplaySize);
            var y = gridMap.GridSize.y - 1 - Mathf.FloorToInt(localY / CellDisplaySize);
            return new Vector2Int(x, y);
        }

        private Rect GetCellRect(Rect gridRect, Vector2Int gridPos)
        {
            var x = gridRect.x + gridPos.x * CellDisplaySize;
            var y = gridRect.y + (gridMap.GridSize.y - 1 - gridPos.y) * CellDisplaySize;
            return new Rect(x, y, CellDisplaySize, CellDisplaySize);
        }

        private void Paint(Vector2Int center)
        {
            Undo.RecordObject(gridMap, "Paint Grid Cells");

            var half = brushSize / 2;
            for (int x = -half; x < brushSize - half; x++)
            {
                for (int y = -half; y < brushSize - half; y++)
                {
                    var pos = new Vector2Int(center.x + x, center.y + y);
                    if (eraseMode)
                    {
                        gridMap.SetCellType(pos, GridCellType.Empty);
                    }
                    else
                    {
                        gridMap.SetCellType(pos, selectedType);
                    }
                }
            }

            EditorUtility.SetDirty(gridMap);
        }

        private void ClearAll()
        {
            if (gridMap == null)
            {
                return;
            }

            Undo.RecordObject(gridMap, "Clear All Grid Cells");
            var keys = new List<Vector2Int>(gridMap.GetCellTypes().Keys);
            foreach (var key in keys)
            {
                gridMap.SetCellType(key, GridCellType.Empty);
            }
            EditorUtility.SetDirty(gridMap);
        }

        private void LoadReferenceTexture()
        {
            if (gridMap == null)
            {
                referenceTexture = null;
                return;
            }

            var spriteRenderer = gridMap.GetComponent<SpriteRenderer>();
            if (spriteRenderer != null && spriteRenderer.sprite != null)
            {
                referenceTexture = spriteRenderer.sprite.texture;
            }
            else
            {
                referenceTexture = null;
            }
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
