using UnityEngine;

namespace DiceTale
{
    public class ItemCondition : Condition
    {
        [SerializeField]
        private string itemId;

        public override bool IsMet(Player player)
        {
            return player != null && player.HasItem(itemId);
        }
    }
}
