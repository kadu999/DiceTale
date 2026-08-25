using UnityEngine;

namespace DiceTale
{
    public class Door : MonoBehaviour, IInteractable
    {
        [SerializeField]
        private string targetSceneName;

        [SerializeField]
        private Condition[] conditions;

        public void Interact(Player player)
        {
            if (conditions != null)
            {
                foreach (var condition in conditions)
                {
                    if (condition != null && !condition.IsMet(player))
                    {
                        Debug.Log("条件不满足");
                        return;
                    }
                }
            }

            if (!string.IsNullOrEmpty(targetSceneName))
            {
                var sceneManager = Object.FindFirstObjectByType<SceneManager>();
                sceneManager?.LoadScene(targetSceneName);
            }
        }
    }
}
