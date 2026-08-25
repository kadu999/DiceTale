using System.Collections.Generic;
using System.IO;
using UnityEngine;

namespace DiceTale
{
    [System.Serializable]
    public class GridMapData
    {
        public List<Vector2Int> obstacles = new List<Vector2Int>();
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

        public int BrushSize => brushSize;

        private HashSet<Vector2Int> obstacleSet = new HashSet<Vector2Int>();
        private List<Vector2Int> obstacles = new List<Vector2Int>();
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
            LoadData();
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

        public void LoadData()
        {
            obstacleSet.Clear();
            obstacles.Clear();

            var textAsset = Resources.Load<TextAsset>(this.name.Replace("(Clone)", ""));
            if (textAsset == null)
            {
                return;
            }

            var data = JsonUtility.FromJson<GridMapData>(textAsset.text);
            if (data?.obstacles == null)
            {
                return;
            }

            foreach (var obstacle in data.obstacles)
            {
                obstacleSet.Add(obstacle);
                obstacles.Add(obstacle);
            }
        }

        public void SaveData()
        {
            var data = new GridMapData { obstacles = new List<Vector2Int>(obstacles) };
            var json = JsonUtility.ToJson(data, true);

#if UNITY_EDITOR
            var directory = Path.Combine(Application.dataPath, "DiceTale/Resources");
            if (!Directory.Exists(directory))
            {
                Directory.CreateDirectory(directory);
            }

            var path = Path.Combine(directory, $"{this.name}.json");
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

            return !obstacleSet.Contains(gridPos) && !dynamicObstacles.Contains(gridPos);
        }

        public void SetObstacle(Vector2Int gridPos, bool isObstacle)
        {
            if (gridPos.x < 0 || gridPos.x >= gridSize.x || gridPos.y < 0 || gridPos.y >= gridSize.y)
            {
                return;
            }

            if (isObstacle)
            {
                if (!obstacleSet.Contains(gridPos))
                {
                    obstacleSet.Add(gridPos);
                    obstacles.Add(gridPos);
                }
            }
            else
            {
                obstacleSet.Remove(gridPos);
                obstacles.Remove(gridPos);
            }
        }

        public IReadOnlyCollection<Vector2Int> GetObstacles()
        {
            return obstacles;
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
    }
}
