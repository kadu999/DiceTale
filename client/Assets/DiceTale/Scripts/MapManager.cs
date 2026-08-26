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
                // 服务器连接（或重连）成功后补报当前地图对象
                connection.OnConnected += ReportMapObjects;
            }

            LoadMap(initialMapName, "Default");
        }

        private void OnDisable()
        {
            var connection = Server.ServerConnection.Instance;
            if (connection != null)
            {
                connection.OnConnected -= ReportMapObjects;
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
                    isPortal = door.IsPortal
                });
            }

            foreach (var spawn in Object.FindObjectsByType<SpawnPoint>(FindObjectsSortMode.None))
            {
                msg.spawnPoints.Add(new Server.SpawnInfo { id = spawn.Id });
            }

            connection.Send(msg);
            Debug.Log($"[MapManager] Reported {msg.doors.Count} doors, {msg.spawnPoints.Count} spawn points for {CurrentMapName}");
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
