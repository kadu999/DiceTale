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
                var registry = BackendRegistry.Instance;
                if (registry != null)
                {
                    connection.OnConnected -= registry.ReportAll;
                }
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

            // 玩家挂在当前地图节点下，切图前先摘下来，避免随旧地图一起销毁
            DetachPlayersFromMap();
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
            // 优先使用 Resources 里的地图预设（含出生点、门、装饰等设计内容）
            var prefab = Resources.Load<GameObject>(mapName);
            if (prefab != null)
            {
                var go = Instantiate(prefab, mapRoot);
                go.name = mapName;

                // 用 .bytes 网格数据覆盖预设的 GridMap（保持服务器/客户端一致的障碍数据）
                var gridMap = go.GetComponent<GridMap>();
                if (gridMap != null)
                {
                    gridMap.LoadData(mapName);
                    gridMap.UpdateCellSize();
                    // 网格尺寸被 .bytes 覆盖后，重新计算动态阻挡占用的格子
                    gridMap.RefreshDynamicObstacles();
                }

                return go;
            }

            // 回退：动态生成（无预设时）
            var dynamicGo = new GameObject(mapName);
            dynamicGo.transform.SetParent(mapRoot, false);

            var dynamicRenderer = dynamicGo.AddComponent<SpriteRenderer>();
            dynamicRenderer.sprite = sprite;

            var dynamicGrid = dynamicGo.AddComponent<GridMap>();
            dynamicGrid.LoadData(mapName);
            dynamicGrid.UpdateCellSize();

            var spawnGo = new GameObject("Spawn_Default");
            spawnGo.transform.SetParent(dynamicGo.transform, false);
            spawnGo.transform.position = dynamicGrid.GridOrigin + new Vector3(dynamicGrid.CellSize * 0.5f, dynamicGrid.CellSize * 0.5f, 0f);
            var spawnPoint = spawnGo.AddComponent<SpawnPoint>();
            spawnPoint.SetId("Default");

            return dynamicGo;
        }

        /// <summary>把玩家移动到指定出生点（spawnId 为空时用第一个出生点），并挂到当前地图节点下。</summary>
        public void MovePlayersToSpawn(string spawnId)
        {
            var characterManager = CharacterManager.Instance;
            if (characterManager == null || characterManager.Players.Count == 0)
            {
                Debug.LogWarning($"[MapManager] MovePlayersToSpawn skipped: no players (players={(characterManager != null ? characterManager.Players.Count : -1)})");
                return;
            }

            // 玩家挂在当前地图节点下（层级跟随地图）
            var parent = CurrentMap != null ? CurrentMap.transform : mapRoot;
            foreach (var player in characterManager.Players)
            {
                if (player != null)
                {
                    player.transform.SetParent(parent, true);
                }
            }

            var spawn = FindSpawn(spawnId);
            if (spawn == null)
            {
                Debug.LogWarning($"[MapManager] Spawn point not found: {spawnId ?? "(default)"} (map={CurrentMapName})");
                return;
            }

            Debug.Log($"[MapManager] Moving {characterManager.Players.Count} player(s) to spawn '{spawn.Id}' at {spawn.Position} (map={CurrentMapName})");
            for (int i = 0; i < characterManager.Players.Count; i++)
            {
                var player = characterManager.Players[i];
                if (player != null)
                {
                    // 多玩家时错开站位（2×2 排列），避免完全重叠难以区分
                    var offset = new Vector3((i % 2) * 0.5f, (i / 2) * 0.5f, 0f);
                    player.transform.position = spawn.Position + offset;
                    player.ReportPosition(); // 传送/出生落点：上报位置
                }
            }
        }

        /// <summary>
        /// 把指定玩家传送到指定地图的指定世界位置。
        /// 目标地图与当前地图不同时先切图（切图后其他玩家停在出生点，本玩家落到目标位置）；
        /// 同图传送不重载地图。
        /// </summary>
        public void TeleportPlayer(Player player, string mapName, Vector3 position)
        {
            if (CurrentMapName != mapName)
            {
                LoadMap(mapName, null);
            }

            if (player != null)
            {
                player.transform.position = position;
                player.ReportPosition(); // 传送落点：上报位置
            }
        }

        /// <summary>
        /// 把指定玩家传送到指定地图上位置标记（<see cref="MapMarker"/>）所在的位置。
        /// 先切到目标地图（同图不重载），再按标记 ID 定位。
        /// </summary>
        /// <returns>标记找到并传送成功返回 true；标记不存在返回 false。</returns>
        public bool TeleportPlayer(Player player, string mapName, string markerId)
        {
            if (CurrentMapName != mapName)
            {
                LoadMap(mapName, null);
            }

            var marker = FindMarker(markerId);
            if (marker == null)
            {
                Debug.LogWarning($"[MapManager] Map marker not found: {markerId} (map={CurrentMapName})");
                return false;
            }

            TeleportPlayer(player, mapName, marker.Position);
            return true;
        }

        /// <summary>在当前地图上按 ID 查找位置标记（忽略大小写）；找不到返回 null。</summary>
        public MapMarker FindMarker(string markerId)
        {
            if (CurrentMap == null || string.IsNullOrEmpty(markerId))
            {
                return null;
            }

            foreach (var marker in CurrentMap.GetComponentsInChildren<MapMarker>())
            {
                if (string.Equals(marker.Id, markerId, System.StringComparison.OrdinalIgnoreCase))
                {
                    return marker;
                }
            }

            return null;
        }

        /// <summary>
        /// 判断物体是否属于其他地图（切图时旧地图销毁前的残留物体）。
        /// 沿父链向上找 MapRoot 的直接子物体：若是带 GridMap 的地图实例且不是当前地图 → 属于旧地图；
        /// 不在任何地图下的物体（如过渡期挂在 MapRoot/场景根的玩家）返回 false，照常上报。
        /// </summary>
        public bool IsFromOtherMap(Transform t)
        {
            if (t == null || CurrentMap == null || mapRoot == null)
            {
                return false;
            }

            var current = t;
            while (current != null)
            {
                if (current.parent == mapRoot)
                {
                    return current != CurrentMap.transform && current.GetComponent<GridMap>() != null;
                }

                current = current.parent;
            }

            return false;
        }

        /// <summary>切换地图前把玩家从当前地图节点摘下来（挂到 MapRoot），避免随旧地图销毁。</summary>
        private void DetachPlayersFromMap()
        {
            var characterManager = CharacterManager.Instance;
            if (characterManager == null)
            {
                return;
            }

            foreach (var player in characterManager.Players)
            {
                if (player != null)
                {
                    player.transform.SetParent(mapRoot, true);
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
