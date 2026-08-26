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
                // 服务器连接（或重连）成功后补报当前地图对象与玩家名单
                connection.OnConnected += ReportMapObjects;
                connection.OnConnected += ReportPlayers;
            }

            LoadMap(initialMapName, "Default");
        }

        private void OnDisable()
        {
            var connection = Server.ServerConnection.Instance;
            if (connection != null)
            {
                connection.OnConnected -= ReportMapObjects;
                connection.OnConnected -= ReportPlayers;
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

            ReportMapObjects();
        }

        /// <summary>
        /// 向服务器上报当前地图的门与出生点，使 GM 后台可控制的对象与游戏内对象一一对应。
        /// 客户端是地图/物体的主导者：位置由客户端换算成图片归一化坐标后上报。
        /// </summary>
        private void ReportMapObjects()
        {
            var connection = Server.ServerConnection.Instance;
            if (connection == null || !connection.IsConnected)
            {
                return;
            }

            var msg = new Server.RegisterMapObjectsMessage { mapName = CurrentMapName };

            foreach (var door in Object.FindObjectsByType<Door>(FindObjectsSortMode.None))
            {
                msg.doors.Add(new Server.DoorInfo
                {
                    id = door.DoorId,
                    targetMap = door.TargetSceneName,
                    targetSpawn = door.TargetSpawnId,
                    isPortal = door.IsPortal,
                    position = GetNormalizedPosition(door.transform.position)
                });
            }

            foreach (var spawn in Object.FindObjectsByType<SpawnPoint>(FindObjectsSortMode.None))
            {
                msg.spawnPoints.Add(new Server.SpawnInfo { id = spawn.Id });
            }

            connection.Send(msg);
            Debug.Log($"[MapManager] Reported {msg.doors.Count} doors, {msg.spawnPoints.Count} spawn points for {CurrentMapName}");
        }

        /// <summary>把世界坐标换算成地图图片上的归一化坐标（y 向下，左上角为原点）。</summary>
        private Server.Position GetNormalizedPosition(Vector3 worldPosition)
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

        // ---- 玩家位置上报 ----

        [SerializeField]
        private float positionReportInterval = 1f;

        private float positionReportTimer;
        private Vector3 lastReportedPosition;

        private void Update()
        {
            positionReportTimer -= Time.deltaTime;
            if (positionReportTimer > 0f)
            {
                return;
            }

            positionReportTimer = positionReportInterval;
            ReportPlayerPosition();
        }

        /// <summary>上报当前玩家名单，供 GM 显示玩家列表。</summary>
        private void ReportPlayers()
        {
            var connection = Server.ServerConnection.Instance;
            if (connection == null || !connection.IsConnected)
            {
                return;
            }

            var characterManager = CharacterManager.Instance;
            if (characterManager == null || characterManager.Players.Count == 0)
            {
                return;
            }

            var msg = new Server.RegisterPlayersMessage();
            foreach (var player in characterManager.Players)
            {
                if (player == null)
                {
                    continue;
                }

                msg.players.Add(new Server.PlayerInfo
                {
                    id = player.PlayerId,
                    name = player.PlayerId
                });
            }

            connection.Send(msg);
        }

        /// <summary>节流上报当前玩家位置，供 GM 后台显示（服务器只记录，不校验）。</summary>
        private void ReportPlayerPosition()
        {
            var connection = Server.ServerConnection.Instance;
            if (connection == null || !connection.IsConnected)
            {
                return;
            }

            var player = CharacterManager.Instance?.CurrentPlayer;
            if (player == null)
            {
                return;
            }

            var pos = player.transform.position;
            if (Vector3.Distance(pos, lastReportedPosition) < 0.01f)
            {
                return;
            }

            lastReportedPosition = pos;
            connection.Send(new Server.ReportPlayerPositionMessage
            {
                playerId = player.PlayerId,
                // 归一化图片坐标（与门位置一致，GM 页面可直接叠加到地图图片上）
                position = GetNormalizedPosition(pos),
                mapName = CurrentMapName
            });
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

        private void MovePlayersToSpawn(string spawnId)
        {
            var characterManager = CharacterManager.Instance;
            if (characterManager == null || characterManager.Players.Count == 0)
            {
                return;
            }

            var spawn = FindSpawn(spawnId);
            if (spawn == null)
            {
                return;
            }

            foreach (var player in characterManager.Players)
            {
                if (player != null)
                {
                    player.transform.position = spawn.Position;
                    player.GetComponent<PlayerMover>()?.Stop();
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
