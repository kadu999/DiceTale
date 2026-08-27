using UnityEngine;

namespace DiceTale
{
    /// <summary>
    /// 传送动作：继承 <see cref="StatefulAction"/>。
    /// 后台触发传送：状态进入（OnStateEnter：初始状态 Start 或后台 set_object_state 切换）时，
    /// 立即把以自身为中心、<see cref="range"/> 半径范围内的所有玩家
    /// 传送到目标地图上 <see cref="MapMarker"/> 标记的位置（targetMapName + targetMarkerId）。
    /// 挂到 SceneObject 的「状态动作列表」即可，进入任意状态都会触发；
    /// <see cref="triggerStateName"/> 非空时仅在该名称的状态下触发。
    /// 若要后台开/关传送区域（开启后玩家进入才传送），用 <see cref="TeleportZoneAction"/>。
    /// </summary>
    public class TeleportAction : StatefulAction
    {
        [SerializeField, Tooltip("传送范围半径（世界单位），以自身为中心")]
        private float range = 1f;

        [SerializeField, Tooltip("目标地图名（如 Map002）")]
        private string targetMapName;

        [SerializeField, Tooltip("目标位置标记 ID：目标地图上的 MapMarker 的 Id")]
        private string targetMarkerId;

        [SerializeField, Tooltip("触发状态名：非空时仅在该名称的状态下触发传送；留空则任意状态切换都触发")]
        private string triggerStateName;

        public override void OnStateEnter(SceneObjectState state)
        {
            if (!string.IsNullOrEmpty(triggerStateName) &&
                !string.Equals(state.Name, triggerStateName, System.StringComparison.OrdinalIgnoreCase))
            {
                return;
            }

            TeleportNearbyPlayers();
        }

        private void OnDrawGizmos()
        {
            // 场景视图画出传送范围圆，方便调试
            Gizmos.color = new Color(0f, 0.8f, 1f, 0.2f);
            Gizmos.DrawSphere(transform.position, range);
            Gizmos.color = new Color(0f, 0.8f, 1f, 0.9f);
            Gizmos.DrawWireSphere(transform.position, range);
        }

        /// <summary>把半径范围内的所有玩家传送到目标地图的目标标记位置。</summary>
        private void TeleportNearbyPlayers()
        {
            if (string.IsNullOrEmpty(targetMapName) || string.IsNullOrEmpty(targetMarkerId))
            {
                return;
            }

            var characterManager = CharacterManager.Instance;
            var mapManager = Object.FindFirstObjectByType<MapManager>();
            if (characterManager == null || mapManager == null)
            {
                return;
            }

            var center = transform.position;

            foreach (var player in characterManager.Players)
            {
                if (player == null)
                {
                    continue;
                }

                if (Vector3.Distance(player.transform.position, center) <= range)
                {
                    mapManager.TeleportPlayer(player, targetMapName, targetMarkerId);
                }
            }
        }
    }
}
