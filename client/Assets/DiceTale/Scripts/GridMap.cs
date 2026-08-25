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
        private float cellSize = 1f;

        [SerializeField]
        private string dataFileName = "Map001_grid";

        private HashSet<Vector2Int> obstacleSet;
        private List<Vector2Int> obstacles = new List<Vector2Int>();

        public Vector2Int GridSize => gridSize;
        public float CellSize => cellSize;
        public string DataFileName => dataFileName;

        private void Awake()
        {
            LoadData();
        }

        private void LoadData()
        {
            obstacleSet = new HashSet<Vector2Int>();
            obstacles.Clear();

            var textAsset = Resources.Load<TextAsset>(dataFileName);
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
            var directory = Path.Combine(Application.dataPath, "Resources");
            if (!Directory.Exists(directory))
            {
                Directory.CreateDirectory(directory);
            }

            var path = Path.Combine(directory, $"{dataFileName}.json");
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

            return !obstacleSet.Contains(gridPos);
        }

        public void SetObstacle(Vector2Int gridPos, bool isObstacle)
        {
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

        public Vector2Int WorldToGrid(Vector3 worldPosition)
        {
            var localPosition = worldPosition - transform.position;
            return new Vector2Int(
                Mathf.FloorToInt(localPosition.x / cellSize),
                Mathf.FloorToInt(localPosition.y / cellSize)
            );
        }

        public Vector3 GridToWorld(Vector2Int gridPos)
        {
            return transform.position + new Vector3(
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

            var queue = new Queue<Vector2Int>();
            var cameFrom = new Dictionary<Vector2Int, Vector2Int>();
            queue.Enqueue(start);
            cameFrom[start] = start;

            int[] dx = { 0, 1, 0, -1 };
            int[] dy = { 1, 0, -1, 0 };

            while (queue.Count > 0)
            {
                var current = queue.Dequeue();
                if (current == end)
                {
                    break;
                }

                for (int i = 0; i < 4; i++)
                {
                    var neighbor = new Vector2Int(current.x + dx[i], current.y + dy[i]);
                    if (IsWalkable(neighbor) && !cameFrom.ContainsKey(neighbor))
                    {
                        queue.Enqueue(neighbor);
                        cameFrom[neighbor] = current;
                    }
                }
            }

            if (!cameFrom.ContainsKey(end))
            {
                return null;
            }

            var path = new List<Vector2Int>();
            var step = end;
            while (step != start)
            {
                path.Add(step);
                step = cameFrom[step];
            }

            path.Reverse();
            return path;
        }
    }
}
