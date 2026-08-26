using UnityEngine;

namespace DiceTale
{
    /// <summary>
    /// 玩家：继承 <see cref="BackendObject"/>，自动注册到后台。
    /// 位置上报只在移动开始/到达时触发（由 PlayerMover 调用），不持续发送轨迹。
    /// </summary>
    public class Player : BackendObject
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
        /// 由 PlayerMover 在移动开始/到达时调用，传送落点由 MapManager 调用。
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
