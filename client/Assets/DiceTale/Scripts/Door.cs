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

        private Collider2D doorCollider;
        private bool isUnlocked;

        private void Awake()
        {
            doorCollider = GetComponent<Collider2D>();
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
            if (!isPortal)
            {
                return;
            }

            var player = other.GetComponent<Player>();
            if (player == null)
            {
                return;
            }

            Interact(player);
        }

        private void OnCollisionEnter2D(Collision2D collision)
        {
            if (isPortal || isUnlocked)
            {
                return;
            }

            var player = collision.collider.GetComponent<Player>();
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
            if (doorCollider == null)
            {
                return;
            }

            doorCollider.isTrigger = isPortal || isUnlocked;

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

            gridMap.AddDynamicObstacle(gridMap.WorldToGrid(transform.position));
        }

        private void UnregisterBlocking()
        {
            var gridMap = Object.FindFirstObjectByType<GridMap>();
            if (gridMap == null)
            {
                return;
            }

            gridMap.RemoveDynamicObstacle(gridMap.WorldToGrid(transform.position));
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
