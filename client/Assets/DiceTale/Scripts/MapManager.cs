using System.Collections;
using System.IO;
using UnityEngine;
using UnityEngine.Networking;

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

        [Tooltip("地图资源服务器地址（HTTP）")]
        [SerializeField]
        private string mapServerUrl = "http://localhost:8080";

        [SerializeField]
        private float downloadTimeout = 5f;

        public string CurrentMapName { get; private set; }
        public GameObject CurrentMap { get; private set; }

        private string loadingMap;

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

            if (CurrentMapName == mapName || loadingMap == mapName)
            {
                return;
            }

            var game = Object.FindFirstObjectByType<Game>();
            game?.LockInteraction(interactionLockDuration);

            loadingMap = mapName;
            UnloadCurrentMap();

            StartCoroutine(LoadMapCoroutine(mapName, spawnId ?? "Default"));
        }

        /// <summary>从服务器下载地图（图片 + 网格），失败时回退本地资源。</summary>
        private IEnumerator LoadMapCoroutine(string mapName, string spawnId)
        {
            // 1. 本地兜底精灵（编辑器 AssetDatabase / 构建 Resources）
            var sprite = LoadMapSpriteLocal(mapName);

            // 2. 尝试从服务器下载地图图片
            using (var request = UnityWebRequestTexture.GetTexture($"{mapServerUrl}/maps/{mapName}.png"))
            {
                request.timeout = Mathf.CeilToInt(downloadTimeout);
                yield return request.SendWebRequest();

                if (request.result == UnityWebRequest.Result.Success)
                {
                    var texture = DownloadHandlerTexture.GetContent(request);
                    if (texture != null)
                    {
                        sprite = Sprite.Create(
                            texture,
                            new Rect(0, 0, texture.width, texture.height),
                            new Vector2(0.5f, 0.5f),
                            100f
                        );
                    }
                }
                else
                {
                    Debug.Log($"[MapManager] Server map image unavailable ({mapName}): {request.error}, using local fallback.");
                }
            }

            if (sprite == null)
            {
                Debug.LogWarning($"Map image not available: {mapName}");
                loadingMap = null;
                yield break;
            }

            // 3. 尝试从服务器下载网格数据
            byte[] gridBytes = null;
            using (var request = UnityWebRequest.Get($"{mapServerUrl}/maps/{mapName}.bytes"))
            {
                request.timeout = Mathf.CeilToInt(downloadTimeout);
                yield return request.SendWebRequest();

                if (request.result == UnityWebRequest.Result.Success)
                {
                    gridBytes = request.downloadHandler.data;
                }
                else
                {
                    Debug.Log($"[MapManager] Server map data unavailable ({mapName}): {request.error}, using local fallback.");
                }
            }

            if (gridBytes == null)
            {
                var textAsset = Resources.Load<TextAsset>(mapName);
                if (textAsset != null)
                {
                    gridBytes = textAsset.bytes;
                }
            }

            CurrentMap = CreateMapGameObject(mapName, sprite, gridBytes);
            CurrentMapName = mapName;
            loadingMap = null;

            MovePlayersToSpawn(spawnId);
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

        private Sprite LoadMapSpriteLocal(string mapName)
        {
#if UNITY_EDITOR
            var path = Path.Combine(imageDirectory, $"{mapName}.png");
            return UnityEditor.AssetDatabase.LoadAssetAtPath<Sprite>(path);
#else
            return Resources.Load<Sprite>(mapName);
#endif
        }

        private GameObject CreateMapGameObject(string mapName, Sprite sprite, byte[] gridBytes)
        {
            var go = new GameObject(mapName);
            go.transform.SetParent(mapRoot, false);

            var spriteRenderer = go.AddComponent<SpriteRenderer>();
            spriteRenderer.sprite = sprite;

            var gridMap = go.AddComponent<GridMap>();
            if (gridBytes != null)
            {
                gridMap.LoadBytes(gridBytes);
            }
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
