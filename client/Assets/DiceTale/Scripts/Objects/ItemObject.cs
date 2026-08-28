using UnityEngine;

namespace DiceTale
{
    /// <summary>
    /// 道具对象：继承 <see cref="BackendObject"/>（纯后台通信）。
    /// 场景中代表一个道具（道具名 + 固定总数）：自动上报到 GM 页面，
    /// 上报的「数量」是固定总数，剩余（总数 − 玩家持有数）由 GM 页面即时推导；
    /// 客户端本地也维护剩余（remaining），GM 分配/收回命令（set_object_items）到达时刷新。
    /// 后台对象 ID 运行时自动生成（唯一，玩家无需知道）。
    /// </summary>
    public class ItemObject : BackendObject
    {
        [SerializeField, Tooltip("道具名（GM 页面显示名，也是分配给玩家的物品名）")]
        private string itemName;

        [SerializeField, Tooltip("道具总数（固定库存；剩余 = 总数 - 所有玩家持有数）")]
        private int quantity = 1;

        [SerializeField, Tooltip("当前剩余（运行时自动计算更新，勿手动修改；GM 页面「剩余」即此值）")]
        private int remaining;

        private string itemId;

        protected override void OnEnable()
        {
            base.OnEnable(); // 注册到后台（必须调用基类，否则不会上报 GM 页面）
            // 地图重载/激活时按当前玩家持有量重算剩余（首次进入时玩家尚未持有，剩余 = 总数）
            RefreshQuantity();
        }

        /// <summary>
        /// 后台对象 ID：首次访问时自动生成唯一 ID（Guid + 物体名，便于 GM 排查）。
        /// </summary>
        public override string ObjectId
        {
            get
            {
                if (string.IsNullOrEmpty(itemId))
                {
                    itemId = $"{gameObject.name}_{System.Guid.NewGuid():N}";
                }

                return itemId;
            }
        }

        /// <summary>GM 页面显示名：道具名（剩余大于 1 时带 ×剩余）；道具名为空时回退对象 ID。</summary>
        public override string DisplayName
        {
            get
            {
                if (string.IsNullOrEmpty(itemName))
                {
                    return ObjectId;
                }

                return remaining > 1 ? $"{itemName} ×{remaining}" : itemName;
            }
        }

        /// <summary>道具名（不含数量，供 GM 页面分配道具使用）。</summary>
        public override string ItemName => itemName;

        /// <summary>道具总数（固定库存），上报给 GM 页面；GM 页面据此推导剩余 = 总数 − 玩家持有数。</summary>
        public override int ItemQuantity => quantity;

        /// <summary>重新计算剩余数量：总数 − 所有玩家已持有该道具的数量（客户端本地状态，随 GM 分配命令更新）。</summary>
        public void RefreshQuantity()
        {
            var held = 0;
            var characterManager = CharacterManager.Instance;
            if (characterManager != null && !string.IsNullOrEmpty(itemName))
            {
                foreach (var player in characterManager.Players)
                {
                    if (player == null)
                    {
                        continue;
                    }

                    foreach (var item in player.Items)
                    {
                        if (item == itemName)
                        {
                            held++;
                        }
                    }
                }
            }

            remaining = Mathf.Max(0, quantity - held);
        }

        /// <summary>刷新场景中所有道具的剩余数量并重新上报（玩家物品列表变化后调用）。</summary>
        public static void RefreshAllQuantities()
        {
            foreach (var item in Object.FindObjectsByType<ItemObject>(FindObjectsSortMode.None))
            {
                item.RefreshQuantity();
            }

            BackendRegistry.Instance.ReportAll(); // 剩余变化后重报，GM 页面同步显示
        }
    }
}
