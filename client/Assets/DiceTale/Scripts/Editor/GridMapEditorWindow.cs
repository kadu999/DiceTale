using System.Collections.Generic;
using System.IO;
using UnityEditor;
using UnityEngine;
using DiceTale;

namespace DiceTale.Editor
{
    public class GridMapEditorWindow : EditorWindow
    {
        private const float CellDisplaySize = 24f;
        private const string ImageDirectory = "Assets/DiceTale/Res/Textures";
        private const string DataDirectory = "Assets/DiceTale/Resources";

        private string mapName = "";
        private Texture2D referenceTexture;
        private Vector2Int gridSize = new Vector2Int(20, 20);
        private float cellSize = 1f;
        private bool autoCellSize = true;

        private Dictionary<Vector2Int, GridCellType> cellTypes = new Dictionary<Vector2Int, GridCellType>();
        private GridCellType selectedType = GridCellType.Obstacle;
        private int brushSize = 1;
        private bool eraseMode;
        private Vector2 scrollPosition;
        private Rect lastGridRect;

        [MenuItem("DiceTale/GridMap Editor")]
        public static void ShowWindow()
        {
            GetWindow<GridMapEditorWindow>("GridMap Editor");
        }

        private void OnGUI()
        {
            DrawToolbar();
            DrawInfo();
            DrawGrid();
            HandleInput();
        }

        private void DrawToolbar()
        {
            EditorGUILayout.BeginHorizontal(EditorStyles.toolbar);

            EditorGUILayout.LabelField("地图名", GUILayout.Width(45f));
            mapName = EditorGUILayout.TextField(mapName, GUILayout.Width(120f));

            if (GUILayout.Button("加载图片", EditorStyles.toolbarButton, GUILayout.Width(80f)))
            {
                LoadReferenceTexture();
            }

            if (GUILayout.Button("Save", EditorStyles.toolbarButton, GUILayout.Width(60f)))
            {
                SaveData();
            }

            if (GUILayout.Button("Load", EditorStyles.toolbarButton, GUILayout.Width(60f)))
            {
                LoadData();
            }

            if (GUILayout.Button("Clear", EditorStyles.toolbarButton, GUILayout.Width(60f)))
            {
                ClearAll();
            }

            EditorGUILayout.EndHorizontal();

            EditorGUILayout.Space();

            EditorGUILayout.BeginHorizontal();
            gridSize = EditorGUILayout.Vector2IntField("网格大小", gridSize);
            if (GUILayout.Button("根据图片计算", GUILayout.Width(100f)))
            {
                CalculateGridSizeFromImage();
            }
            EditorGUILayout.EndHorizontal();

            EditorGUILayout.BeginHorizontal();
            autoCellSize = EditorGUILayout.Toggle("自动格子大小", autoCellSize);
            if (!autoCellSize)
            {
                cellSize = EditorGUILayout.FloatField("格子大小", cellSize);
            }
            else if (referenceTexture != null)
            {
                EditorGUI.BeginDisabledGroup(true);
                EditorGUILayout.FloatField("格子大小", cellSize);
                EditorGUI.EndDisabledGroup();
            }
            EditorGUILayout.EndHorizontal();

            EditorGUILayout.BeginHorizontal();
            selectedType = (GridCellType)EditorGUILayout.EnumPopup("画笔类型", selectedType);
            brushSize = EditorGUILayout.IntSlider("画笔大小", brushSize, 1, 5);
            EditorGUILayout.EndHorizontal();

            eraseMode = EditorGUILayout.Toggle("橡皮擦模式", eraseMode);
        }

        private void DrawInfo()
        {
            EditorGUILayout.LabelField($"Grid Size: {gridSize.x} x {gridSize.y}");
            EditorGUILayout.LabelField($"Cell Size: {cellSize:F2}");
            EditorGUILayout.Space();
        }

        private void DrawGrid()
        {
            var totalWidth = gridSize.x * CellDisplaySize;
            var totalHeight = gridSize.y * CellDisplaySize;

            scrollPosition = EditorGUILayout.BeginScrollView(scrollPosition, GUILayout.Width(position.width), GUILayout.Height(position.height - 160f));

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
            foreach (var pair in cellTypes)
            {
                var rect = GetCellRect(gridRect, pair.Key);
                EditorGUI.DrawRect(rect, GetCellColor(pair.Value));
            }
        }

        private void DrawGridLines(Rect gridRect)
        {
            Handles.color = new Color(1f, 1f, 1f, 0.3f);

            for (int x = 0; x <= gridSize.x; x++)
            {
                var xPos = gridRect.x + x * CellDisplaySize;
                Handles.DrawLine(new Vector3(xPos, gridRect.y), new Vector3(xPos, gridRect.yMax));
            }

            for (int y = 0; y <= gridSize.y; y++)
            {
                var yPos = gridRect.y + y * CellDisplaySize;
                Handles.DrawLine(new Vector3(gridRect.x, yPos), new Vector3(gridRect.xMax, yPos));
            }
        }

        private void HandleInput()
        {
            var e = Event.current;
            if (e == null)
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
            var y = gridSize.y - 1 - Mathf.FloorToInt(localY / CellDisplaySize);
            return new Vector2Int(x, y);
        }

        private Rect GetCellRect(Rect gridRect, Vector2Int gridPos)
        {
            var x = gridRect.x + gridPos.x * CellDisplaySize;
            var y = gridRect.y + (gridSize.y - 1 - gridPos.y) * CellDisplaySize;
            return new Rect(x, y, CellDisplaySize, CellDisplaySize);
        }

        private void Paint(Vector2Int center)
        {
            var half = brushSize / 2;
            for (int x = -half; x < brushSize - half; x++)
            {
                for (int y = -half; y < brushSize - half; y++)
                {
                    var pos = new Vector2Int(center.x + x, center.y + y);
                    if (eraseMode)
                    {
                        cellTypes.Remove(pos);
                    }
                    else
                    {
                        cellTypes[pos] = selectedType;
                    }
                }
            }
        }

        private void ClearAll()
        {
            cellTypes.Clear();
        }

        private void LoadReferenceTexture()
        {
            referenceTexture = null;
            cellSize = 1f;

            if (string.IsNullOrEmpty(mapName))
            {
                return;
            }

            var path = Path.Combine(ImageDirectory, $"{mapName}.png");
            referenceTexture = AssetDatabase.LoadAssetAtPath<Texture2D>(path);

            if (referenceTexture == null)
            {
                Debug.LogWarning($"图片未找到: {path}");
                return;
            }

            CalculateGridSizeFromImage();
            LoadData();
        }

        private void CalculateGridSizeFromImage()
        {
            if (referenceTexture == null)
            {
                return;
            }

            if (cellSize <= 0f)
            {
                cellSize = 1f;
            }

            gridSize = new Vector2Int(
                Mathf.RoundToInt(referenceTexture.width / cellSize),
                Mathf.RoundToInt(referenceTexture.height / cellSize)
            );
        }

        private void SaveData()
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
            var directory = Path.Combine(Application.dataPath, "DiceTale/Resources");
            if (!Directory.Exists(directory))
            {
                Directory.CreateDirectory(directory);
            }

            var path = Path.Combine(directory, $"{mapName}.json");
            File.WriteAllText(path, json);
            AssetDatabase.Refresh();
            Debug.Log($"地图数据已保存: {path}");
        }

        private void LoadData()
        {
            cellTypes.Clear();

            if (string.IsNullOrEmpty(mapName))
            {
                return;
            }

            var path = Path.Combine(Application.dataPath, $"DiceTale/Resources/{mapName}.json");
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

            gridSize = new Vector2Int(data.gridSizeX, data.gridSizeY);
            foreach (var cell in data.cells)
            {
                cellTypes[new Vector2Int(cell.x, cell.y)] = (GridCellType)cell.type;
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
