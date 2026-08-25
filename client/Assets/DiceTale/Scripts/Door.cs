using UnityEngine;
using UnityEngine.Events;

namespace DiceTale
{
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

        public void OpenDoor()
        {
            var player = CharacterManager.Instance?.CurrentPlayer;
            Interact(player);
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
