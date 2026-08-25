using System.Collections.Generic;
using System.IO;
using UnityEngine;

namespace DiceTale
{
    [System.Serializable]
    public class GridCellData
    {
        public int x;
        public int y;
        public int type;
    }

    [System.Serializable]
    public class GridMapData
    {
        public int gridSizeX = 20;
        public int gridSizeY = 20;
        public List<GridCellData> cells = new List<GridCellData>();
    }

    public class GridMap : MonoBehaviour
    {
        [SerializeField]
        private Vector2Int gridSize = new Vector2Int(20, 20);

        [SerializeField]
        private bool autoCellSize = true;

        [SerializeField]
        private float cellSize = 1f;

        [SerializeField]
        [Range(1, 5)]
        private int brushSize = 1;

        [SerializeField]
        private bool drawBlockedCells = true;

        public int BrushSize => brushSize;

        private Dictionary<Vector2Int, GridCellType> cellTypes = new Dictionary<Vector2Int, GridCellType>();
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
            UpdateCellSize();
        }

        private void OnEnable()
        {
            RefreshDoorObstacles();
        }

        private void RefreshDoorObstacles()
        {
            ClearDynamicObstacles();
            var doors = Object.FindObjectsByType<Door>(FindObjectsSortMode.None);
            foreach (var door in doors)
            {
                door.RefreshBlocking();
            }
        }

        public void UpdateCellSize()
        {
            if (!autoCellSize)
            {
                return;
            }

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
            cellTypes.Clear();

            var name = fileName ?? this.name.Replace("(Clone)", "");
            var textAsset = Resources.Load<TextAsset>(name);
            if (textAsset == null)
            {
                return;
            }

            var data = JsonUtility.FromJson<GridMapData>(textAsset.text);
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

        public void SaveData(string fileName = null)
        {
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

#if UNITY_EDITOR
            var directory = Path.Combine(Application.dataPath, "DiceTale/Resources");
            if (!Directory.Exists(directory))
            {
                Directory.CreateDirectory(directory);
            }

            var path = Path.Combine(directory, $"{fileName ?? this.name}.json");
            File.WriteAllText(path, json);
            UnityEditor.AssetDatabase.Refresh();
#endif
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

            if (cellTypes.TryGetValue(gridPos, out var type))
            {
                return type != GridCellType.Obstacle;
            }

            return true;
        }

        public void SetCellType(Vector2Int gridPos, GridCellType type)
        {
            if (gridPos.x < 0 || gridPos.x >= gridSize.x || gridPos.y < 0 || gridPos.y >= gridSize.y)
            {
                return;
            }

            if (type == GridCellType.Empty)
            {
                cellTypes.Remove(gridPos);
            }
            else
            {
                cellTypes[gridPos] = type;
            }
        }

        public GridCellType GetCellType(Vector2Int gridPos)
        {
            if (gridPos.x < 0 || gridPos.x >= gridSize.x || gridPos.y < 0 || gridPos.y >= gridSize.y)
            {
                return GridCellType.Empty;
            }

            if (cellTypes.TryGetValue(gridPos, out var type))
            {
                return type;
            }

            return GridCellType.Empty;
        }

        public IReadOnlyDictionary<Vector2Int, GridCellType> GetCellTypes()
        {
            return cellTypes;
        }

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

            foreach (var pair in cellTypes)
            {
                DrawCellGizmo(pair.Key, GetCellTypeColor(pair.Value));
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
                default:
                    return Color.clear;
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
