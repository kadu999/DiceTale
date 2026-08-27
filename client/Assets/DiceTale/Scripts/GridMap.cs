using System.Collections.Generic;
using System.IO;
using UnityEngine;

namespace DiceTale
{
    [System.Serializable]
    public class GridMapData
    {
        public int gridSizeX = 20;
        public int gridSizeY = 20;
        public int[] cells = new int[0];
    }

    public class GridMap : MonoBehaviour
    {
        [SerializeField]
        private Vector2Int gridSize = new Vector2Int(20, 20);

        [SerializeField]
        private float cellSize = 1f;

        [SerializeField]
        private bool drawBlockedCells = true;

        private GridCellType[,] cellGrid;
        private HashSet<Vector2Int> dynamicObstacles = new HashSet<Vector2Int>();

        public Vector2Int GridSize => gridSize;
        public float CellSize => cellSize;

        public Vector3 GridOrigin => transform.position - new Vector3(
            gridSize.x * cellSize * 0.5f,
            gridSize.y * cellSize * 0.5f,
            0f
        );

        public float GridWidth => gridSize.x * cellSize;
        public float GridHeight => gridSize.y * cellSize;

        private void Awake()
        {
            EnsureCellGrid();
            UpdateCellSize();
        }

        /// <summary>确保 cellGrid 已初始化（默认全空格子），数据未加载（如缺少 .bytes）时也不会 NRE。</summary>
        private void EnsureCellGrid()
        {
            if (cellGrid == null)
            {
                cellGrid = new GridCellType[gridSize.x, gridSize.y];
            }
        }

        public void UpdateCellSize()
        {

            var spriteRenderer = GetComponent<SpriteRenderer>();
            if (spriteRenderer == null || spriteRenderer.sprite == null)
            {
                return;
            }

            var size = spriteRenderer.bounds.size;
            if (gridSize.x > 0)
            {
                cellSize = size.x / gridSize.x;
            }
        }

        public void LoadData(string fileName = null)
        {
            var name = fileName ?? this.name.Replace("(Clone)", "");
            var textAsset = Resources.Load<TextAsset>(name);
            if (textAsset == null)
            {
                return;
            }

            using (var reader = new BinaryReader(new MemoryStream(textAsset.bytes)))
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

                gridSize = new Vector2Int(data.gridSizeX, data.gridSizeY);
                cellGrid = new GridCellType[gridSize.x, gridSize.y];

                for (int y = 0; y < gridSize.y; y++)
                {
                    for (int x = 0; x < gridSize.x; x++)
                    {
                        cellGrid[x, y] = MaskToGridCellType(GetCellMask(data.cells, x, y, gridSize.x));
                    }
                }
            }
        }

        public void SaveData(string fileName = null)
        {
            EnsureCellGrid(); // 编辑器未加载数据时也能安全保存（全空格子）

            var data = new GridMapData
            {
                gridSizeX = gridSize.x,
                gridSizeY = gridSize.y,
                cells = new int[gridSize.x * gridSize.y]
            };

            for (int x = 0; x < gridSize.x; x++)
            {
                for (int y = 0; y < gridSize.y; y++)
                {
                    SetCellMask(data.cells, x, y, gridSize.x, GridCellTypeToMask(cellGrid[x, y]));
                }
            }

#if UNITY_EDITOR
            var directory = Path.Combine(Application.dataPath, "DiceTale/Resources");
            if (!Directory.Exists(directory))
            {
                Directory.CreateDirectory(directory);
            }

            var path = Path.Combine(directory, $"{fileName ?? this.name}.bytes");
            using (var writer = new BinaryWriter(File.Open(path, FileMode.Create)))
            {
                writer.Write(data.gridSizeX);
                writer.Write(data.gridSizeY);
                foreach (var mask in data.cells)
                {
                    writer.Write(mask);
                }
            }
            UnityEditor.AssetDatabase.Refresh();
#endif
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
                case GridCellType.Fog1: return 8;
                case GridCellType.Fog2: return 16;
                case GridCellType.Fog3: return 32;
                case GridCellType.Fog4: return 64;
                case GridCellType.Fog5: return 128;
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
                case 8: return GridCellType.Fog1;
                case 16: return GridCellType.Fog2;
                case 32: return GridCellType.Fog3;
                case 64: return GridCellType.Fog4;
                case 128: return GridCellType.Fog5;
                default: return GridCellType.Empty;
            }
        }

        public bool IsWalkable(Vector2Int gridPos)
        {
            if (gridPos.x < 0 || gridPos.x >= gridSize.x || gridPos.y < 0 || gridPos.y >= gridSize.y)
            {
                return false;
            }

            if (dynamicObstacles.Contains(gridPos))
            {
                return false;
            }

            return GetCellType(gridPos) != GridCellType.Obstacle;
        }

        public void SetCellType(Vector2Int gridPos, GridCellType type)
        {
            if (cellGrid == null || !IsInside(gridPos))
            {
                return;
            }

            cellGrid[gridPos.x, gridPos.y] = type;
        }

        public GridCellType GetCellType(Vector2Int gridPos)
        {
            if (cellGrid == null || !IsInside(gridPos))
            {
                return GridCellType.Empty;
            }

            return cellGrid[gridPos.x, gridPos.y];
        }

        private bool IsInside(Vector2Int gridPos)
        {
            return gridPos.x >= 0 && gridPos.x < gridSize.x && gridPos.y >= 0 && gridPos.y < gridSize.y;
        }

        /// <summary>格子二维数组（[x, y]，值为格子类型）。</summary>
        public GridCellType[,] CellGrid => cellGrid;

        public void AddDynamicObstacle(Vector2Int gridPos)
        {
            if (gridPos.x < 0 || gridPos.x >= gridSize.x || gridPos.y < 0 || gridPos.y >= gridSize.y)
            {
                return;
            }

            dynamicObstacles.Add(gridPos);
        }

        public void RemoveDynamicObstacle(Vector2Int gridPos)
        {
            dynamicObstacles.Remove(gridPos);
        }

        public void ClearDynamicObstacles()
        {
            dynamicObstacles.Clear();
        }

        /// <summary>网格数据/尺寸变化后，让所有动态阻挡重新计算占用格子（网格加载完成后调用）。</summary>
        public void RefreshDynamicObstacles()
        {
            foreach (var obstacle in Object.FindObjectsByType<DynamicObstacle>(FindObjectsSortMode.None))
            {
                obstacle.RefreshBlocking();
            }
        }

        public Vector2Int WorldToGrid(Vector3 worldPosition)
        {
            var localPosition = worldPosition - GridOrigin;
            return new Vector2Int(
                Mathf.FloorToInt(localPosition.x / cellSize),
                Mathf.FloorToInt(localPosition.y / cellSize)
            );
        }

        public Vector3 GridToWorld(Vector2Int gridPos)
        {
            return GridOrigin + new Vector3(
                gridPos.x * cellSize + cellSize * 0.5f,
                gridPos.y * cellSize + cellSize * 0.5f,
                0f
            );
        }

        public List<Vector2Int> FindPath(Vector2Int start, Vector2Int end)
        {
            if (!IsWalkable(end))
            {
                return null;
            }

            if (start == end)
            {
                return new List<Vector2Int>();
            }

            var openSet = new List<Vector2Int> { start };
            var cameFrom = new Dictionary<Vector2Int, Vector2Int>();
            var gScore = new Dictionary<Vector2Int, float> { [start] = 0 };
            var fScore = new Dictionary<Vector2Int, float> { [start] = Heuristic(start, end) };

            int[] dx = { 0, 1, 0, -1 };
            int[] dy = { 1, 0, -1, 0 };

            while (openSet.Count > 0)
            {
                var current = openSet[0];
                var lowestIndex = 0;
                for (int i = 1; i < openSet.Count; i++)
                {
                    if (fScore[openSet[i]] < fScore[current])
                    {
                        current = openSet[i];
                        lowestIndex = i;
                    }
                }

                if (current == end)
                {
                    return ReconstructPath(cameFrom, current, start);
                }

                openSet.RemoveAt(lowestIndex);

                for (int i = 0; i < 4; i++)
                {
                    var neighbor = new Vector2Int(current.x + dx[i], current.y + dy[i]);
                    if (!IsWalkable(neighbor))
                    {
                        continue;
                    }

                    var tentativeG = gScore[current] + 1;
                    if (!gScore.ContainsKey(neighbor) || tentativeG < gScore[neighbor])
                    {
                        cameFrom[neighbor] = current;
                        gScore[neighbor] = tentativeG;
                        fScore[neighbor] = tentativeG + Heuristic(neighbor, end);

                        if (!openSet.Contains(neighbor))
                        {
                            openSet.Add(neighbor);
                        }
                    }
                }
            }

            return null;
        }

        private static float Heuristic(Vector2Int a, Vector2Int b)
        {
            return Mathf.Abs(a.x - b.x) + Mathf.Abs(a.y - b.y);
        }

        private static List<Vector2Int> ReconstructPath(Dictionary<Vector2Int, Vector2Int> cameFrom, Vector2Int current, Vector2Int start)
        {
            var path = new List<Vector2Int> { current };
            while (current != start)
            {
                current = cameFrom[current];
                path.Add(current);
            }
            path.Reverse();
            path.RemoveAt(0);
            return path;
        }

        private void OnDrawGizmos()
        {
            if (!drawBlockedCells)
            {
                return;
            }

            if (cellGrid == null)
            {
                return;
            }

            for (int x = 0; x < gridSize.x; x++)
            {
                for (int y = 0; y < gridSize.y; y++)
                {
                    var type = cellGrid[x, y];
                    // 雾格子由 FogOfWar 按区域控制显示，Gizmos 不画雾，避免 Scene 视图误判
                    if (type == GridCellType.Empty || IsFogType(type))
                    {
                        continue;
                    }

                    DrawCellGizmo(new Vector2Int(x, y), GetCellTypeColor(type));
                }
            }

            var dynamicColor = new Color(1f, 0f, 1f, 0.5f);
            foreach (var obstacle in dynamicObstacles)
            {
                DrawCellGizmo(obstacle, dynamicColor);
            }
        }

        private static Color GetCellTypeColor(GridCellType type)
        {
            switch (type)
            {
                case GridCellType.Obstacle:
                    return new Color(1f, 0f, 0f, 0.5f);
                case GridCellType.Difficult:
                    return new Color(1f, 0.5f, 0f, 0.5f);
                case GridCellType.Water:
                    return new Color(0f, 0.5f, 1f, 0.5f);
                case GridCellType.Fog1:
                    return new Color(0.85f, 0.85f, 0.85f, 0.4f);
                case GridCellType.Fog2:
                    return new Color(0.3f, 0.8f, 0.9f, 0.45f);
                case GridCellType.Fog3:
                    return new Color(0.65f, 0.4f, 0.9f, 0.5f);
                case GridCellType.Fog4:
                    return new Color(1f, 0.65f, 0.15f, 0.55f);
                case GridCellType.Fog5:
                    return new Color(0.95f, 0.3f, 0.3f, 0.6f);
                default:
                    return Color.clear;
            }
        }

        private static bool IsFogType(GridCellType type)
        {
            switch (type)
            {
                case GridCellType.Fog1:
                case GridCellType.Fog2:
                case GridCellType.Fog3:
                case GridCellType.Fog4:
                case GridCellType.Fog5:
                    return true;
                default:
                    return false;
            }
        }

        private void DrawCellGizmo(Vector2Int gridPos, Color color)
        {
            if (gridPos.x < 0 || gridPos.x >= gridSize.x || gridPos.y < 0 || gridPos.y >= gridSize.y)
            {
                return;
            }

            Gizmos.color = color;
            var center = GridToWorld(gridPos);
            var size = new Vector3(cellSize, cellSize, 0.1f);
            Gizmos.DrawCube(center, size);
        }
    }
}
