using System.Collections.Generic;
using UnityEngine;

namespace DiceTale
{
    /// <summary>
    /// 传送动作：继承 <see cref="StatefulAction"/>。
    /// 后台触发传送：状态进入（OnStateEnter：初始状态 Start 或后台 set_object_state 切换）时，
    /// 把目标玩家传送到目标地图上 <see cref="MapMarker"/> 标记的位置（targetMapName + targetMarkerId）。
    /// 目标玩家默认是 <see cref="range"/> 半径范围内（以自身为中心）的玩家；
    /// 勾选 <see cref="teleportAllPlayers"/> 时忽略半径，传送当前地图上的所有玩家。
    /// 挂到 StateMachine 的「状态动作列表」即可，进入任意状态都会触发；
    /// <see cref="triggerStateName"/> 非空时仅在该名称的状态下触发。
    /// 若要后台开/关传送区域（开启后玩家进入才传送），用 <see cref="TeleportZoneAction"/>。
    /// </summary>
    public class TeleportAction : StatefulAction
    {
        [SerializeField, Tooltip("传送范围半径（世界单位），以自身为中心")]
        private float range = 1f;

        [SerializeField, Tooltip("是否传送当前地图上的所有玩家（忽略范围半径）；不勾选则只传送半径范围内的玩家")]
        private bool teleportAllPlayers = false;

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

        /// <summary>把目标玩家传送到目标地图的目标标记位置。
        /// 先按当前状态收集目标再逐个传送：首名玩家传送可能切换地图，后续玩家的位置已被重定位，
        /// 边遍历边判定距离会得到错误结果。</summary>
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

            // 目标集合：全部玩家（忽略半径）或半径范围内的玩家主体
            var center = transform.position;
            var targets = new List<BackendObject>();
            foreach (var player in characterManager.Players)
            {
                if (player == null)
                {
                    continue;
                }

                if (teleportAllPlayers || Vector3.Distance(player.transform.position, center) <= range)
                {
                    targets.Add(player);
                }
            }

            if (targets.Count == 0)
            {
                return;
            }

            // 逐个传送；多人时按网格格子大小方阵错开站位，避免全部叠在标记点上
            for (int i = 0; i < targets.Count; i++)
            {
                mapManager.TeleportPlayer(targets[i], targetMapName, targetMarkerId, MapManager.GetSpawnOffset(i, targets.Count));
            }
        }
    }
}
