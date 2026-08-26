using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Events;

namespace DiceTale
{
    [RequireComponent(typeof(Collider2D))]
    public class Door : MonoBehaviour, IInteractable
    {
        [SerializeField]
        private string targetSceneName;

        [SerializeField]
        private string targetSpawnId = "Default";

        [SerializeField]
        private string doorId;

        [SerializeField]
        private bool isPortal = true;

        [SerializeField]
        private UnityEvent onUnlocked;

        [SerializeField]
        private Collider2D blockingCollider;

        private Collider2D triggerCollider;
        private bool isUnlocked;
        private List<Vector2Int> registeredObstacles = new List<Vector2Int>();

        /// <summary>供服务器命令分发与对象上报读取的门标识。</summary>
        public string DoorId => doorId;
        public string TargetSceneName => targetSceneName;
        public string TargetSpawnId => targetSpawnId;
        public bool IsPortal => isPortal;

        private void Awake()
        {
            triggerCollider = GetComponent<Collider2D>();
            if (triggerCollider != null)
            {
                triggerCollider.isTrigger = true;
            }

            RefreshBlocking();
        }

        private void OnEnable()
        {
            RegisterBlocking();
        }

        private void OnDisable()
        {
            UnregisterBlocking();
        }

        private void OnTriggerEnter2D(Collider2D other)
        {
            var player = other.GetComponent<Player>();
            if (player == null)
            {
                return;
            }

            Interact(player);
        }

        public void Interact(Player player)
        {
            if (BackendManager.Instance != null && !string.IsNullOrEmpty(doorId))
            {
                BackendManager.Instance.RequestDoorAccess(doorId, allowed =>
                {
                    if (allowed)
                    {
                        ExecuteInteract();
                    }
                });
                return;
            }

            ExecuteInteract();
        }

        private void ExecuteInteract()
        {
            if (isPortal)
            {
                var connection = Server.ServerConnection.Instance;
                if (connection != null && connection.IsConnected)
                {
                    // 传送门：由服务器下发 teleport_player 命令后切换地图，
                    // 客户端不直接切图，保证服务器是权威状态源。
                    Debug.Log($"[Door] Portal {doorId} access granted, waiting for server teleport.");
                }
                else
                {
                    // 服务器不可用时本地回退，保证单机仍可玩
                    LoadTargetMap();
                }
            }
            else if (!isUnlocked)
            {
                SetUnlocked(true);
            }
        }

        public void SetUnlocked(bool unlocked)
        {
            if (isUnlocked == unlocked)
            {
                return;
            }

            isUnlocked = unlocked;
            RefreshBlocking();

            if (isUnlocked)
            {
                onUnlocked?.Invoke();
            }
        }

        public bool IsUnlocked => isUnlocked;

        public void RefreshBlocking()
        {
            if (triggerCollider != null)
            {
                triggerCollider.isTrigger = true;
            }

            if (blockingCollider != null)
            {
                blockingCollider.isTrigger = false;
                blockingCollider.enabled = !isPortal && !isUnlocked;
            }

            if (isPortal || isUnlocked)
            {
                UnregisterBlocking();
            }
            else
            {
                RegisterBlocking();
            }
        }

        private void RegisterBlocking()
        {
            if (isPortal || isUnlocked || blockingCollider == null)
            {
                return;
            }

            var gridMap = Object.FindFirstObjectByType<GridMap>();
            if (gridMap == null)
            {
                return;
            }

            UnregisterBlocking();

            var bounds = blockingCollider.bounds;
            var min = gridMap.WorldToGrid(bounds.min);
            var max = gridMap.WorldToGrid(bounds.max);

            for (int x = min.x; x <= max.x; x++)
            {
                for (int y = min.y; y <= max.y; y++)
                {
                    var gridPos = new Vector2Int(x, y);
                    gridMap.AddDynamicObstacle(gridPos);
                    registeredObstacles.Add(gridPos);
                }
            }
        }

        private void UnregisterBlocking()
        {
            var gridMap = Object.FindFirstObjectByType<GridMap>();
            if (gridMap == null)
            {
                registeredObstacles.Clear();
                return;
            }

            foreach (var gridPos in registeredObstacles)
            {
                gridMap.RemoveDynamicObstacle(gridPos);
            }
            registeredObstacles.Clear();
        }

        private void LoadTargetMap()
        {
            if (!string.IsNullOrEmpty(targetSceneName))
            {
                var mapManager = Object.FindFirstObjectByType<MapManager>();
                mapManager?.LoadMap(targetSceneName, targetSpawnId);
            }
        }
    }
}
