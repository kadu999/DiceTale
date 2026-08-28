using System.Collections.Generic;
using UnityEngine;

namespace DiceTale
{
    /// <summary>
    /// 物品组件（组件模型下的能力组件，由原 SceneObject 的物品列表拆分而来）：
    /// 持有物品列表并与后台同步（IItemInventory），供玩家等持有物品的物体使用。
    /// 与 <see cref="BackendObject"/> 枢纽挂同一物体，增删物品后经枢纽上报（ReportItems）。
    /// </summary>
    [DisallowMultipleComponent]
    [RequireComponent(typeof(BackendObject))]
    public class ItemInventory : MonoBehaviour, IItemInventory
    {
        private readonly List<string> items = new List<string>();

        /// <summary>物品列表（只读视图；修改用 AddItem/RemoveItem/SetItems，与后台同步）。</summary>
        public IReadOnlyList<string> Items => items;

        /// <summary>添加物品（重复添加忽略；与后台同步）。</summary>
        public void AddItem(string item)
        {
            if (string.IsNullOrEmpty(item) || items.Contains(item))
            {
                return;
            }

            items.Add(item);
            ReportItems();
        }

        /// <summary>移除物品（不存在时无操作；与后台同步）。</summary>
        public void RemoveItem(string item)
        {
            if (items.Remove(item))
            {
                ReportItems();
            }
        }

        /// <summary>整体设置物品列表（后台 set_object_items 命令经枢纽转发调用，与后台同步）。</summary>
        public void SetItems(IEnumerable<string> newItems)
        {
            items.Clear();
            if (newItems != null)
            {
                items.AddRange(newItems);
            }

            ReportItems();
        }

        /// <summary>物品列表变化后经枢纽上报给后台（GM 页面同步显示）。</summary>
        private void ReportItems()
        {
            GetComponent<BackendObject>()?.ReportItems();
        }
    }
}
