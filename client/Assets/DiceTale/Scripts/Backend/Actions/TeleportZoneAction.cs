using UnityEngine;

namespace DiceTale
{
    /// <summary>
    /// 传送区域动作：继承 <see cref="BackendChangeAction"/>。
    /// 后台用 set_object_state 开启/关闭传送：组件数据改变（OnComponentChanged：OptionValue 选项切换，
    /// 或 base 的 source 组件数据改变）时评估，切到 <see cref="enabledStateName"/> 状态则激活传送区域，
    /// 激活后玩家进入圆形范围（CircleCollider2D，自动设为 Trigger）即被传送到
    /// 目标地图上 <see cref="MapMarker"/> 标记的位置（targetMapName + targetMarkerId）；
    /// 切到其他状态时关闭传送（进入不传送）。
    /// 把基类 BackendChangeAction 的 source 字段指向目标组件即可：任意选项切换都会重新评估开/关。
    /// 若要后台切状态时直接传送圆内玩家（不等进入），用 <see cref="TeleportAction"/>。
    /// </summary>
    [RequireComponent(typeof(CircleCollider2D))]
    public class TeleportZoneAction : BackendChangeAction
    {
        [SerializeField, Tooltip("目标地图名（如 Map002）")]
        private string targetMapName;

        [SerializeField, Tooltip("目标位置标记 ID：目标地图上的 MapMarker 的 Id")]
        private string targetMarkerId;

        [SerializeField, Tooltip("开启状态名：后台切到该状态时激活传送；切到其他状态时关闭（留空则始终开启）")]
        private string enabledStateName;

        private bool zoneEnabled;
        private CircleCollider2D circleCollider;

        private void OnValidate()
        {
            SetTrigger();
        }

        private void Awake()
        {
            SetTrigger();
            // 未配置开启状态名时默认始终开启；配置了则先关闭，等进入开启状态再激活
            zoneEnabled = string.IsNullOrEmpty(enabledStateName);
        }

        public override void OnComponentChanged(BackendComponent component)
        {
            if (!(component is OptionValue sm))
            {
                return;
            }

            zoneEnabled = string.IsNullOrEmpty(enabledStateName) ||
                string.Equals(sm.CurrentStateName, enabledStateName, System.StringComparison.OrdinalIgnoreCase);
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
