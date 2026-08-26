using System.Collections.Generic;
using System.IO;
using DiceTale;
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
        [SerializeField] private List<GridCellData> serializedCells = new List<GridCellData>();

        private Dictionary<Vector2Int, GridCellType> cellTypes = new Dictionary<Vector2Int, GridCellType>();

        public string MapName { get => mapName; set => mapName = value; }
        public Vector2Int GridSize { get => gridSize; set => gridSize = Vector2Int.Max(value, Vector2Int.one); }
        public float CellSize { get => cellSize; set => cellSize = value > 0f ? value : 1f; }
        public bool AutoCellSize { get => autoCellSize; set => autoCellSize = value; }
        public GridCellType SelectedType { get => selectedType; set => selectedType = value; }
        public int BrushSize { get => brushSize; set => brushSize = Mathf.Clamp(value, GridMapEditorConstants.MinBrushSize, GridMapEditorConstants.MaxBrushSize); }
        public bool EraseMode { get => eraseMode; set => eraseMode = value; }
        [field: System.NonSerialized]
        public Texture2D ReferenceTexture { get; set; }
        public IReadOnlyDictionary<Vector2Int, GridCellType> CellTypes => cellTypes;

        private void OnEnable()
        {
            Undo.undoRedoPerformed -= RebuildDictionary;
            Undo.undoRedoPerformed += RebuildDictionary;
            RebuildDictionary();
        }

        private void OnDisable()
        {
            Undo.undoRedoPerformed -= RebuildDictionary;
        }

        private void OnValidate()
        {
            RebuildDictionary();
        }

        private void RebuildDictionary()
        {
            cellTypes.Clear();
            if (serializedCells == null)
            {
                return;
            }

            foreach (var cell in serializedCells)
            {
                if (cell == null)
                {
                    continue;
                }

                var pos = new Vector2Int(cell.x, cell.y);
                var type = (GridCellType)cell.type;
                if (type != GridCellType.Empty && IsInsideGrid(pos))
                {
                    cellTypes[pos] = type;
                }
            }
        }

        private void SyncDictionaryToSerializedCells()
        {
            if (serializedCells == null)
            {
                serializedCells = new List<GridCellData>();
            }

            serializedCells.Clear();
            foreach (var pair in cellTypes)
            {
                serializedCells.Add(new GridCellData
                {
                    x = pair.Key.x,
                    y = pair.Key.y,
                    type = (int)pair.Value
                });
            }
        }

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

            SyncDictionaryToSerializedCells();
        }

        public void Clear()
        {
            Undo.RecordObject(this, "Clear Grid");
            cellTypes.Clear();
            SyncDictionaryToSerializedCells();
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
            if (string.IsNullOrEmpty(mapName))
            {
                return;
            }

            var path = Path.Combine(Application.dataPath, GridMapEditorConstants.DataDirectoryFull, $"{mapName}.json");
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

            Undo.RecordObject(this, "Load Grid");
            cellTypes.Clear();

            GridSize = new Vector2Int(data.gridSizeX, data.gridSizeY);
            foreach (var cell in data.cells)
            {
                var pos = new Vector2Int(cell.x, cell.y);
                if (IsInsideGrid(pos))
                {
                    cellTypes[pos] = (GridCellType)cell.type;
                }
            }

            SyncDictionaryToSerializedCells();
        }

        public void LoadReferenceTexture()
        {
            ReferenceTexture = null;

            if (string.IsNullOrEmpty(mapName))
            {
                return;
            }

            var path = Path.Combine(GridMapEditorConstants.ImageDirectory, $"{mapName}.png").Replace('\\', '/');
            ReferenceTexture = AssetDatabase.LoadAssetAtPath<Texture2D>(path);

            if (ReferenceTexture == null)
            {
                Debug.LogWarning($"图片未找到: {path}");
                return;
            }

            if (autoCellSize || cellSize <= 0f)
            {
                CellSize = 1f;
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

            Undo.RecordObject(this, "Calculate Grid Size");

            GridSize = new Vector2Int(
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
