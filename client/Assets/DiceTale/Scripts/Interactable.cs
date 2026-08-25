using UnityEngine;
using UnityEngine.Events;

namespace DiceTale
{
    public class Interactable : MonoBehaviour
    {
        [SerializeField]
        private string id;

        [SerializeField]
        private string displayName;

        [SerializeField]
        private string interactionText = "Interact";

        [SerializeField]
        private UnityEvent onInteract;

        public string Id => id;
        public string DisplayName => displayName;
        public string InteractionText => interactionText;

        public void Interact(Player player)
        {
            var handlers = GetComponents<IInteractable>();
            foreach (var handler in handlers)
            {
                if (handler is Interactable)
                {
                    continue;
                }

                handler.Interact(player);
            }

            onInteract?.Invoke();
        }
    }
}
