using System.IO;
using UnityEngine;

namespace DiceTale
{
    public class MapManager : MonoBehaviour
    {
        [SerializeField]
        private string initialMapName = "Map001";

        [SerializeField]
        private Transform mapRoot;

        [SerializeField]
        private float interactionLockDuration = 0.5f;

        [SerializeField]
        private string imageDirectory = "Assets/DiceTale/Res/Textures";

        public string CurrentMapName { get; private set; }
        public GameObject CurrentMap { get; private set; }

        private void Awake()
        {
            if (mapRoot == null)
            {
                var rootGo = new GameObject("MapRoot");
                mapRoot = rootGo.transform;
            }
        }

        private void Start()
        {
            var connection = Server.ServerConnection.Instance;
            if (connection != null)
            {
                // 后台连接（或重连）成功后统一补报所有 BackendObject（门、出生点、玩家）
                connection.OnConnected += BackendRegistry.Instance.ReportAll;
            }

            LoadMap(initialMapName, "Default");
        }

        private void OnDisable()
        {
            var connection = Server.ServerConnection.Instance;
            if (connection != null)
            {
                connection.OnConnected -= BackendRegistry.Instance.ReportAll;
            }
        }

        public void LoadMap(string mapName, string spawnId = null)
        {
            if (string.IsNullOrEmpty(mapName))
            {
                return;
            }

            if (CurrentMapName == mapName)
            {
                return;
            }

            var game = Object.FindFirstObjectByType<Game>();
            game?.LockInteraction(interactionLockDuration);

            UnloadCurrentMap();

            var sprite = LoadMapSprite(mapName);
            if (sprite == null)
            {
                Debug.LogWarning($"Map image not found: {mapName}");
                return;
            }

            CurrentMap = CreateMapGameObject(mapName, sprite);
            CurrentMapName = mapName;

            MovePlayersToSpawn(spawnId ?? "Default");

            // 地图变化后统一上报所有后台对象（门/出生点/玩家名单）
            BackendRegistry.Instance.ReportAll();
        }

        /// <summary>把世界坐标换算成地图图片上的归一化坐标（y 向下，左上角为原点）。</summary>
        public Server.Position GetNormalizedPosition(Vector3 worldPosition)
        {
            var spriteRenderer = CurrentMap != null ? CurrentMap.GetComponent<SpriteRenderer>() : null;
            if (spriteRenderer == null || spriteRenderer.sprite == null)
            {
                return new Server.Position { x = 0.5f, y = 0.5f };
            }

            var bounds = spriteRenderer.bounds;
            if (bounds.size.x <= 0f || bounds.size.y <= 0f)
            {
                return new Server.Position { x = 0.5f, y = 0.5f };
            }

            return new Server.Position
            {
                x = Mathf.Clamp01((worldPosition.x - bounds.min.x) / bounds.size.x),
                y = Mathf.Clamp01(1f - (worldPosition.y - bounds.min.y) / bounds.size.y)
            };
        }

        private Sprite LoadMapSprite(string mapName)
        {
#if UNITY_EDITOR
            var path = Path.Combine(imageDirectory, $"{mapName}.png");
            return UnityEditor.AssetDatabase.LoadAssetAtPath<Sprite>(path);
#else
            return Resources.Load<Sprite>(mapName);
#endif
        }

        private GameObject CreateMapGameObject(string mapName, Sprite sprite)
        {
            var go = new GameObject(mapName);
            go.transform.SetParent(mapRoot, false);

            var spriteRenderer = go.AddComponent<SpriteRenderer>();
            spriteRenderer.sprite = sprite;

            var gridMap = go.AddComponent<GridMap>();
            gridMap.LoadData(mapName);
            gridMap.UpdateCellSize();

            var spawnGo = new GameObject("Spawn_Default");
            spawnGo.transform.SetParent(go.transform, false);
            spawnGo.transform.position = gridMap.GridOrigin + new Vector3(gridMap.CellSize * 0.5f, gridMap.CellSize * 0.5f, 0f);
            var spawnPoint = spawnGo.AddComponent<SpawnPoint>();
            spawnPoint.SetId("Default");

            return go;
        }

        /// <summary>把玩家移动到指定出生点（spawnId 为空时用第一个出生点）。</summary>
        public void MovePlayersToSpawn(string spawnId)
        {
            var characterManager = CharacterManager.Instance;
            if (characterManager == null || characterManager.Players.Count == 0)
            {
                Debug.LogWarning($"[MapManager] MovePlayersToSpawn skipped: no players (players={(characterManager != null ? characterManager.Players.Count : -1)})");
                return;
            }

            var spawn = FindSpawn(spawnId);
            if (spawn == null)
            {
                Debug.LogWarning($"[MapManager] Spawn point not found: {spawnId ?? "(default)"} (map={CurrentMapName})");
                return;
            }

            Debug.Log($"[MapManager] Moving {characterManager.Players.Count} player(s) to spawn '{spawn.Id}' at {spawn.Position} (map={CurrentMapName})");
            foreach (var player in characterManager.Players)
            {
                if (player != null)
                {
                    player.transform.position = spawn.Position;
                    player.ReportPosition(); // 传送/出生落点：上报位置
                }
            }
        }

        private SpawnPoint FindSpawn(string spawnId)
        {
            var spawns = mapRoot.GetComponentsInChildren<SpawnPoint>();

            foreach (var spawn in spawns)
            {
                if (spawn.Id == spawnId)
                {
                    return spawn;
                }
            }

            return spawns.Length > 0 ? spawns[0] : null;
        }

        private void UnloadCurrentMap()
        {
            if (CurrentMap != null)
            {
                Destroy(CurrentMap);
                CurrentMap = null;
            }
        }
    }
}
