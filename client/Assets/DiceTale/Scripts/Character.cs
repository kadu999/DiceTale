using System.Collections.Generic;
using UnityEngine;

namespace DiceTale
{
    public class Character : MonoBehaviour
    {
        private readonly HashSet<string> itemIds = new HashSet<string>();

        public void AddItem(Item item)
        {
            if (item == null)
            {
                return;
            }

            itemIds.Add(item.ItemId);
        }

        public bool HasItem(string itemId)
        {
            return !string.IsNullOrEmpty(itemId) && itemIds.Contains(itemId);
        }

        public bool RemoveItem(string itemId)
        {
            return !string.IsNullOrEmpty(itemId) && itemIds.Remove(itemId);
        }
    }
}
