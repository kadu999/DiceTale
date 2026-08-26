using UnityEngine;

namespace DiceTale
{
    /// <summary>
    /// 传送门：玩家触碰后请求后台下发 teleport_player 命令切换地图（通用 request_teleport 消息）。
    /// 后台不可用时本地回退切图，保证单机仍可玩。
    /// </summary>
    public class PortalDoor : Door
    {
        [SerializeField]
        private string targetSceneName;

        [SerializeField]
        private string targetSpawnId = "Default";

        public override bool IsPortal => true;

        protected override void ExecuteInteract()
        {
            var connection = Server.ServerConnection.Instance;
            if (connection != null && connection.IsConnected)
            {
                // 传送门：请求后台下发 teleport_player 命令后切换地图，客户端不直接切图
                SendToBackend(new Server.RequestTeleportMessage
                {
                    mapName = targetSceneName,
                    spawnId = targetSpawnId
                });
            }
            else
            {
                // 后台不可用时本地回退，保证单机仍可玩
                LoadTargetMap();
            }
        }

        private void LoadTargetMap()
        {
            if (!string.IsNullOrEmpty(targetSceneName))
            {
                var mapManager = Object.FindFirstObjectByType<MapManager>();
                mapManager?.LoadMap(targetSceneName, targetSpawnId);
            }
        }
    }
}
