using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Events;

namespace DiceTale
{
    /// <summary>
    /// 门：普通门（玩家触碰后开门，可由后台控制开关）。
    /// 传送门请使用 <see cref="PortalDoor"/>。
    /// 继承 <see cref="BackendObject"/>，自动注册上报、受后台控制。
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

        /// <summary>供服务器命令分发与对象上报读取的门标识。</summary>
        public string DoorId => doorId;

        /// <summary>是否为传送门（PortalDoor 覆写为 true）。</summary>
        public virtual bool IsPortal => false;

        /// <summary>上报用的传送目标地图（普通门为空）。</summary>
        protected virtual string ReportTargetMap => "";

        /// <summary>上报用的传送目标出生点（普通门为空）。</summary>
        protected virtual string ReportTargetSpawn => "";

        /// <summary>后台对象 ID：门使用自己的 doorId。</summary>
        public override string ObjectId => doorId;

        public override void AppendToReport(Server.RegisterMapObjectsMessage mapObjects, Server.RegisterPlayersMessage players)
        {
            mapObjects.doors.Add(new Server.DoorInfo
            {
                id = doorId,
                targetMap = ReportTargetMap,
                targetSpawn = ReportTargetSpawn,
                isPortal = IsPortal,
                position = NormalizePosition(transform.position)
            });
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

        public void Interact(Player player)
        {
            if (BackendManager.Instance != null && !string.IsNullOrEmpty(doorId))
            {
                BackendManager.Instance.RequestDoorAccess(doorId, allowed =>
                {
                    if (allowed)
                    {
                        ExecuteInteract();
                    }
                });
                return;
            }

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
