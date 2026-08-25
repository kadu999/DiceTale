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
        private Condition[] conditions;

        [SerializeField]
        private bool isPortal = true;

        [SerializeField]
        private UnityEvent onUnlocked;

        [SerializeField]
        private Collider2D blockingCollider;

        private Collider2D triggerCollider;
        private bool isUnlocked;
        private List<Vector2Int> registeredObstacles = new List<Vector2Int>();

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
            if (!CheckConditions(player))
            {
                return;
            }

            if (isPortal)
            {
                LoadTargetMap();
            }
            else if (!isUnlocked)
            {
                isUnlocked = true;
                RefreshBlocking();
                onUnlocked?.Invoke();
            }
        }

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
            if (isPortal || isUnlocked)
            {
                return;
            }

            var gridMap = Object.FindFirstObjectByType<GridMap>();
            if (gridMap == null)
            {
                return;
            }

            UnregisterBlocking();

            if (blockingCollider == null)
            {
                var gridPos = gridMap.WorldToGrid(transform.position);
                gridMap.AddDynamicObstacle(gridPos);
                registeredObstacles.Add(gridPos);
                return;
            }

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

        private bool CheckConditions(Player player)
        {
            if (conditions != null)
            {
                foreach (var condition in conditions)
                {
                    if (condition != null && !condition.IsMet(player))
                    {
                        Debug.Log("条件不满足");
                        return false;
                    }
                }
            }

            return true;
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
