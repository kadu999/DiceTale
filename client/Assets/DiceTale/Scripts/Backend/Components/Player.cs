using System.Collections.Generic;
using UnityEngine;

namespace DiceTale
{
    /// <summary>
    /// 玩家角色组件（组件模型下的能力组件，原 Player 的角色部分）：
    /// 提供玩家唯一标识（PlayerId）、玩家名单上报与位置上报（IBackendRole）。
    /// 继承 <see cref="BackendComponent"/>，与 <see cref="BackendObject"/> 枢纽挂同一物体；
    /// 物品列表由同物体的 <see cref="ItemInventory"/> 提供。
    /// </summary>
    public class Player : BackendComponent, IBackendRole
    {
        /// <summary>组件 ID（与客户端组件类同名；角色组件不进 GM 面板清单）。</summary>
        public override string ComponentId => "Player";

        /// <summary>角色组件不进 GM 属性面板清单（由玩家名单页处理）。</summary>
        public override bool GmEditable => false;

        private static readonly List<string> EmptyItems = new List<string>();

        /// <summary>玩家唯一标识（由 CharacterManager 分配，上报给后台）。</summary>
        public string PlayerId { get; private set; } = "Player_1";

        /// <summary>后台对象 ID：玩家使用自己的 PlayerId（IBackendRole）。</summary>
        public string ObjectId => PlayerId;

        /// <summary>GM 页面显示的名称：取枢纽显示名（默认回退 PlayerId）。</summary>
        public string DisplayName => GetComponent<BackendObject>()?.DisplayName ?? PlayerId;

        /// <summary>物品列表（由同物体的 ItemInventory 提供；无物品组件时为空）。</summary>
        public IReadOnlyList<string> Items
        {
            get
            {
                var inventory = GetComponent<ItemInventory>();
                return inventory != null ? inventory.Items : EmptyItems;
            }
        }

        public void SetPlayerId(string playerId)
        {
            if (!string.IsNullOrEmpty(playerId))
            {
                PlayerId = playerId;
            }
        }

        public void AppendToReport(Server.RegisterMapObjectsMessage mapObjects, Server.RegisterPlayersMessage players)
        {
            players.players.Add(new Server.PlayerInfo
            {
                id = PlayerId,
                name = PlayerId
            });
        }

        /// <summary>
        /// 上报当前玩家位置（归一化图片坐标）。
        /// 由 InputManager 在瞬移后调用，传送落点由 MapManager 调用。
        /// </summary>
        public void ReportPosition()
        {
            var hub = GetComponent<BackendObject>();
            if (hub == null)
            {
                return;
            }

            hub.SendToBackend(new Server.ReportPlayerPositionMessage
            {
                playerId = PlayerId,
                position = hub.NormalizePosition(transform.position),
                mapName = GetCurrentMapName()
            });
        }

        private string GetCurrentMapName()
        {
            var mapManager = Object.FindFirstObjectByType<MapManager>();
            return mapManager != null ? mapManager.CurrentMapName : null;
        }
    }
}
