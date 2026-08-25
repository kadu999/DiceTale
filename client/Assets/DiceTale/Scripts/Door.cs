using UnityEngine;
using UnityEngine.Events;

namespace DiceTale
{
    [RequireComponent(typeof(Collider2D))]
    public class Door : MonoBehaviour
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

        private void Awake()
        {
            var collider = GetComponent<Collider2D>();
            if (collider != null)
            {
                collider.isTrigger = true;
            }
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
            else
            {
                onUnlocked?.Invoke();
            }
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
