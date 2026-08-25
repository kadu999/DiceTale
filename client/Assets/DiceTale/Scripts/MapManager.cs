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
            LoadMap(initialMapName, "Default");
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
