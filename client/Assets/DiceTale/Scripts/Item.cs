using UnityEngine;

namespace DiceTale
{
    public class Item : MonoBehaviour, IInteractable
    {
        [SerializeField]
        private string itemId;

        [SerializeField]
        private string eventName;

        public string ItemId => itemId;

        public void Interact(Player player)
        {
            if (player == null)
            {
                return;
            }

            player.AddItem(this);

            if (!string.IsNullOrEmpty(eventName))
            {
                var progressManager = Object.FindFirstObjectByType<ProgressManager>();
                progressManager?.RaiseEvent(eventName);
            }

            Destroy(gameObject);
        }
    }
}
