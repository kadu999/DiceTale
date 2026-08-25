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
                mapRoot = transform;
            }

            LoadMap(initialMapName);
        }

        public void LoadMap(string mapName)
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
