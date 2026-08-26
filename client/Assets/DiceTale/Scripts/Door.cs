using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Events;

namespace DiceTale
{
    /// <summary>
    /// 门：玩家触碰后开门（本地行为），门本体阻挡逻辑在客户端维护。
    /// 传送门请使用 <see cref="PortalDoor"/>。
    /// 继承 <see cref="BackendObject"/>：自动出现在 GM 页面对象列表，
    /// 开关统一走通用状态机制（Inspector 状态列表，如 "closed"/"open"，
    /// Action 挂 <see cref="SetUnlocked"/>），后台用 set_object_state 切换。
    /// </summary>
    [RequireComponent(typeof(Collider2D))]
    public class Door : BackendObject, IInteractable
    {
        [SerializeField]
        private string doorId;

        [SerializeField]
        private UnityEvent onUnlocked;

        [SerializeField]
        private Collider2D blockingCollider;

        private Collider2D triggerCollider;
        private bool isUnlocked;
        private List<Vector2Int> registeredObstacles = new List<Vector2Int>();

        /// <summary>门标识（同时作为后台对象 ID）。</summary>
        public string DoorId => doorId;

        /// <summary>是否为传送门（PortalDoor 覆写为 true）。</summary>
        public virtual bool IsPortal => false;

        /// <summary>后台对象 ID：门使用自己的 doorId。</summary>
        public override string ObjectId => doorId;

        public override void AppendToReport(Server.RegisterMapObjectsMessage mapObjects, Server.RegisterPlayersMessage players)
        {
            // 门不再上报专用 doors 字段：统一由 BackendObject 通用状态（objects）上报，
            // GM 页面通过状态列表控制开关
        }

        private void Awake()
        {
            triggerCollider = GetComponent<Collider2D>();
            if (triggerCollider != null)
            {
                triggerCollider.isTrigger = true;
            }

            RefreshBlocking();
        }

        protected override void OnEnable()
        {
            base.OnEnable();
            RegisterBlocking();
        }

        protected override void OnDisable()
        {
            base.OnDisable();
            UnregisterBlocking();
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

        /// <summary>玩家触碰：普通门直接开门（本地行为），传送门由 PortalDoor 覆写。</summary>
        public void Interact(Player player)
        {
            ExecuteInteract();
        }

        /// <summary>触碰后的行为（普通门：开门；PortalDoor 覆写为传送）。</summary>
        protected virtual void ExecuteInteract()
        {
            if (!isUnlocked)
            {
                SetUnlocked(true);
            }
        }

        public void SetUnlocked(bool unlocked)
        {
            if (isUnlocked == unlocked)
            {
                return;
            }

            isUnlocked = unlocked;
            RefreshBlocking();

            if (isUnlocked)
            {
                onUnlocked?.Invoke();
            }

            SyncGenericState(unlocked);
        }

        /// <summary>
        /// 把开门/关门同步到通用状态机（若配置了 open/closed 等状态），
        /// 使 GM 页面显示与本地行为一致。GM 用 set_object_state 切换时，
        /// 状态的 Action 调用 SetUnlocked 回到这里，因已是同状态不会重复触发。
        /// </summary>
        private void SyncGenericState(bool unlocked)
        {
            var stateName = unlocked ? "open" : "closed";
            if (!HasState(stateName))
            {
                stateName = unlocked ? "unlocked" : "locked";
            }

            if (HasState(stateName))
            {
                TrySetState(stateName);
            }
        }

        public bool IsUnlocked => isUnlocked;

        public void RefreshBlocking()
        {
            if (triggerCollider != null)
            {
                triggerCollider.isTrigger = true;
            }

            if (blockingCollider != null)
            {
                blockingCollider.isTrigger = false;
                blockingCollider.enabled = !IsPortal && !isUnlocked;
            }

            if (IsPortal || isUnlocked)
            {
                UnregisterBlocking();
            }
            else
            {
                RegisterBlocking();
            }
        }

        private void RegisterBlocking()
        {
            if (IsPortal || isUnlocked || blockingCollider == null)
            {
                return;
            }

            var gridMap = Object.FindFirstObjectByType<GridMap>();
            if (gridMap == null)
            {
                return;
            }

            UnregisterBlocking();

            var bounds = blockingCollider.bounds;
            var min = gridMap.WorldToGrid(bounds.min);
            var max = gridMap.WorldToGrid(bounds.max);

            for (int x = min.x; x <= max.x; x++)
            {
                for (int y = min.y; y <= max.y; y++)
                {
                    var gridPos = new Vector2Int(x, y);
                    gridMap.AddDynamicObstacle(gridPos);
                    registeredObstacles.Add(gridPos);
                }
            }
        }

        private void UnregisterBlocking()
        {
            var gridMap = Object.FindFirstObjectByType<GridMap>();
            if (gridMap == null)
            {
                registeredObstacles.Clear();
                return;
            }

            foreach (var gridPos in registeredObstacles)
            {
                gridMap.RemoveDynamicObstacle(gridPos);
            }
            registeredObstacles.Clear();
        }
    }
}
