using UnityEngine;

namespace DiceTale
{
    /// <summary>
    /// 传送区域动作：继承 <see cref="ConditionalBackendChangeAction"/>。
    /// 后台操作组件值开启/关闭传送：组件数据改变（OnComponentChanged）时用基类条件评估所属组件的当前值，
    /// 条件满足则激活传送区域，激活后玩家进入圆形范围（CircleCollider2D，自动设为 Trigger）即被传送到
    /// 目标地图上 <see cref="MapMarker"/> 标记的位置（targetMapName + targetMarkerId）；
    /// 条件不满足时关闭传送（进入不传送）。条件支持任意覆写 Satisfies 的值组件；留空则始终开启。
    /// 挂到组件的「变更动作列表」（actions）即可。
    /// 若要后台切状态时直接传送圆内玩家（不等进入），用 <see cref="TeleportAction"/>。
    /// </summary>
    [RequireComponent(typeof(CircleCollider2D))]
    public class TeleportZoneAction : ConditionalBackendChangeAction
    {
        [SerializeField, Tooltip("目标地图名（如 Map002）")]
        private string targetMapName;

        [SerializeField, Tooltip("目标位置标记 ID：目标地图上的 MapMarker 的 Id")]
        private string targetMarkerId;

        private bool zoneEnabled;
        private CircleCollider2D circleCollider;

        private void OnValidate()
        {
            SetTrigger();
        }

        private void Awake()
        {
            SetTrigger();
            // 未配置条件时默认始终开启；配置了则先关闭，等条件满足再激活
            zoneEnabled = ConditionMet(null);
        }

        public override void OnComponentChanged(BackendComponent component)
        {
            zoneEnabled = ConditionMet(component);
        }

        private void OnTriggerEnter2D(Collider2D other)
        {
            if (!zoneEnabled)
            {
                return;
            }

            var player = other.GetComponent<BackendObject>();
            if (player == null || player.ObjectKind != "Player")
            {
                return;
            }

            var mapManager = Object.FindFirstObjectByType<MapManager>();
            if (mapManager == null || string.IsNullOrEmpty(targetMapName) || string.IsNullOrEmpty(targetMarkerId))
            {
                return;
            }

            mapManager.TeleportPlayer(player, targetMapName, targetMarkerId);
        }

        private void SetTrigger()
        {
            if (circleCollider == null)
            {
                circleCollider = GetComponent<CircleCollider2D>();
            }

            if (circleCollider != null)
            {
                circleCollider.isTrigger = true;
            }
        }
    }
}
