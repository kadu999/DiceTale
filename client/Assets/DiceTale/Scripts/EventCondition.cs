using UnityEngine;

namespace DiceTale
{
    public class EventCondition : Condition
    {
        [SerializeField]
        private string eventName;

        private ProgressManager progressManager;

        private void Awake()
        {
            progressManager = Object.FindFirstObjectByType<ProgressManager>();
        }

        public override bool IsMet(Player player)
        {
            return progressManager != null && progressManager.HasEvent(eventName);
        }
    }
}
