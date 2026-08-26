using UnityEngine;

namespace DiceTale
{
    /// <summary>
    /// 玩家：继承 <see cref="BackendObject"/>，自动注册到后台并上报名单与位置。
    /// </summary>
    public class Player : BackendObject
    {
        /// <summary>玩家唯一标识（由 CharacterManager 分配，上报给后台）。</summary>
        public string PlayerId { get; private set; } = "Player_1";

        [SerializeField]
        private float positionReportInterval = 1f;

        private float positionReportTimer;
        private Vector3 lastReportedPosition;

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

        private void Update()
        {
            positionReportTimer -= Time.deltaTime;
            if (positionReportTimer > 0f)
            {
                return;
            }

            positionReportTimer = positionReportInterval;
            ReportPosition();
        }

        /// <summary>节流上报当前位置（归一化图片坐标），供后台显示。</summary>
        private void ReportPosition()
        {
            var connection = Server.ServerConnection.Instance;
            if (connection == null || !connection.IsConnected)
            {
                return;
            }

            var pos = transform.position;
            if (Vector3.Distance(pos, lastReportedPosition) < 0.01f)
            {
                return;
            }

            lastReportedPosition = pos;
            SendToBackend(new Server.ReportPlayerPositionMessage
            {
                playerId = PlayerId,
                position = NormalizePosition(pos),
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
