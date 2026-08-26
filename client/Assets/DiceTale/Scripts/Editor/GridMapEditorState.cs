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
        [SerializeField] private GridCellType selectedType = GridCellType.Obstacle;
        [SerializeField] private int brushSize = 1;
        [SerializeField] private bool eraseMode;
        [SerializeField] private List<SerializedCell> serializedCells = new List<SerializedCell>();

        private Dictionary<Vector2Int, GridCellType> cellTypes = new Dictionary<Vector2Int, GridCellType>();

        [System.Serializable]
        private class SerializedCell
        {
            public int x;
            public int y;
            public int mask;
        }

        public string MapName { get => mapName; set => mapName = value; }
        public Vector2Int GridSize { get => gridSize; set => gridSize = Vector2Int.Max(value, Vector2Int.one); }
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
                var type = MaskToGridCellType(cell.mask);
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
                serializedCells = new List<SerializedCell>();
            }

            serializedCells.Clear();
            foreach (var pair in cellTypes)
            {
                serializedCells.Add(new SerializedCell
                {
                    x = pair.Key.x,
                    y = pair.Key.y,
                    mask = GridCellTypeToMask(pair.Value)
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
                gridSizeY = gridSize.y,
                cells = new int[gridSize.x * gridSize.y]
            };

            foreach (var pair in cellTypes)
            {
                SetCellMask(data.cells, pair.Key.x, pair.Key.y, gridSize.x, GridCellTypeToMask(pair.Value));
            }

            var directory = Path.Combine(Application.dataPath, GridMapEditorConstants.DataDirectoryFull);
            if (!Directory.Exists(directory))
            {
                Directory.CreateDirectory(directory);
            }

            var path = Path.Combine(directory, $"{mapName}.bytes");
            using (var writer = new BinaryWriter(File.Open(path, FileMode.Create)))
            {
                writer.Write(data.gridSizeX);
                writer.Write(data.gridSizeY);
                foreach (var mask in data.cells)
                {
                    writer.Write(mask);
                }
            }
            AssetDatabase.Refresh();
            Debug.Log($"地图数据已保存: {path}");
        }

        public void LoadData()
        {
            if (string.IsNullOrEmpty(mapName))
            {
                return;
            }

            var path = Path.Combine(Application.dataPath, GridMapEditorConstants.DataDirectoryFull, $"{mapName}.bytes");
            if (!File.Exists(path))
            {
                return;
            }

            using (var reader = new BinaryReader(File.Open(path, FileMode.Open)))
            {
                var data = new GridMapData();
                data.gridSizeX = reader.ReadInt32();
                data.gridSizeY = reader.ReadInt32();
                var count = data.gridSizeX * data.gridSizeY;
                data.cells = new int[count];
                for (int i = 0; i < count; i++)
                {
                    data.cells[i] = reader.ReadInt32();
                }

                Undo.RecordObject(this, "Load Grid");
                cellTypes.Clear();

                GridSize = new Vector2Int(data.gridSizeX, data.gridSizeY);
                for (int y = 0; y < gridSize.y; y++)
                {
                    for (int x = 0; x < gridSize.x; x++)
                    {
                        var pos = new Vector2Int(x, y);
                        var type = MaskToGridCellType(GetCellMask(data.cells, x, y, gridSize.x));
                        if (IsInsideGrid(pos) && type != GridCellType.Empty)
                        {
                            cellTypes[pos] = type;
                        }
                    }
                }

                SyncDictionaryToSerializedCells();
            }
        }

        public void LoadReferenceTexture(string filePath)
        {
            ReferenceTexture = null;

            if (string.IsNullOrEmpty(filePath) || !File.Exists(filePath))
            {
                Debug.LogWarning($"图片路径无效: {filePath}");
                return;
            }

            var bytes = File.ReadAllBytes(filePath);
            var texture = new Texture2D(2, 2);
            if (!texture.LoadImage(bytes))
            {
                Debug.LogWarning($"无法解析图片: {filePath}");
                Object.DestroyImmediate(texture);
                return;
            }

            ReferenceTexture = texture;
            MapName = Path.GetFileNameWithoutExtension(filePath);

            LoadData();
        }

        private bool IsInsideGrid(Vector2Int pos)
        {
            return pos.x >= 0 && pos.x < gridSize.x && pos.y >= 0 && pos.y < gridSize.y;
        }

        private static int GetCellMask(int[] cells, int x, int y, int width)
        {
            return cells[y * width + x];
        }

        private static void SetCellMask(int[] cells, int x, int y, int width, int mask)
        {
            cells[y * width + x] = mask;
        }

        private static int GridCellTypeToMask(GridCellType type)
        {
            switch (type)
            {
                case GridCellType.Obstacle: return 1;
                case GridCellType.Difficult: return 2;
                case GridCellType.Water: return 4;
                default: return 0;
            }
        }

        private static GridCellType MaskToGridCellType(int mask)
        {
            switch (mask)
            {
                case 1: return GridCellType.Obstacle;
                case 2: return GridCellType.Difficult;
                case 4: return GridCellType.Water;
                default: return GridCellType.Empty;
            }
        }
    }
}
