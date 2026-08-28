using UnityEngine;

namespace DiceTale
{
    /// <summary>
    /// 玩家：继承 <see cref="SceneObject"/>（后台通信 + 状态机 + 物品能力），自动注册到后台。
    /// 位置上报在瞬移/传送落点时触发（由 InputManager / MapManager 调用）；
    /// 物品列表为 SceneObject 通用能力（与后台同步），玩家直接继承使用。
    /// </summary>
    public class Player : SceneObject
    {
        /// <summary>玩家唯一标识（由 CharacterManager 分配，上报给后台）。</summary>
        public string PlayerId { get; private set; } = "Player_1";

        /// <summary>后台对象 ID：玩家使用自己的 PlayerId。</summary>
        public override string ObjectId => PlayerId;

        public void SetPlayerId(string playerId)
        {
            if (!string.IsNullOrEmpty(playerId))
            {
                PlayerId = playerId;
            }
        }

        public override void AppendToReport(Server.RegisterMapObjectsMessage mapObjects, Server.RegisterPlayersMessage players)
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
            var connection = Server.ServerConnection.Instance;
            if (connection == null || !connection.IsConnected)
            {
                return;
            }

            SendToBackend(new Server.ReportPlayerPositionMessage
            {
                playerId = PlayerId,
                position = NormalizePosition(transform.position),
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
