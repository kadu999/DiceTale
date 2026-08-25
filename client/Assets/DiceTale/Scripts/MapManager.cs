using UnityEngine;

namespace DiceTale
{
    public class MapManager : MonoBehaviour
    {
        [SerializeField]
        private string initialMapName = "Map001";

        [SerializeField]
        private Transform mapRoot;

        public string CurrentMapName { get; private set; }
        public GameObject CurrentMap { get; private set; }

        private void Awake()
        {
            if (mapRoot == null)
            {
                var rootGo = new GameObject("MapRoot");
                mapRoot = rootGo.transform;
            }

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

            UnloadCurrentMap();

            var prefab = Resources.Load<GameObject>(mapName);
            if (prefab == null)
            {
                Debug.LogWarning($"Map prefab not found: {mapName}");
                return;
            }

            CurrentMap = Instantiate(prefab, mapRoot);
            CurrentMap.name = mapName;
            CurrentMapName = mapName;

            SpawnPlayers();
            MovePlayersToSpawn(spawnId ?? "Default");
        }

        private void SpawnPlayers()
        {
            var characterManager = CharacterManager.Instance;
            if (characterManager == null)
            {
                return;
            }

            characterManager.ClearPlayers();

            var playerPrefab = Resources.Load<GameObject>("Player");
            if (playerPrefab == null)
            {
                Debug.LogWarning("Player prefab not found in Resources");
                return;
            }

            var spawns = mapRoot.GetComponentsInChildren<PlayerSpawn>();
            foreach (var spawn in spawns)
            {
                var playerGo = Instantiate(playerPrefab, spawn.Position, Quaternion.identity);
                var player = playerGo.GetComponent<Player>();
                if (player != null)
                {
                    characterManager.AddPlayer(player);
                }
            }

            if (characterManager.Players.Count > 0)
            {
                characterManager.SetCurrentPlayer(0);
            }
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
                }
            }
        }

        private PlayerSpawn FindSpawn(string spawnId)
        {
            var spawns = mapRoot.GetComponentsInChildren<PlayerSpawn>();

            foreach (var spawn in spawns)
            {
                if (spawn.SpawnId == spawnId)
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
