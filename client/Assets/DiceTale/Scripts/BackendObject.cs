using UnityEngine;

namespace DiceTale
{
    /// <summary>
    /// 后台对象基类：场景中所有需要与后台（backend）通信、或受后台控制的物体
    /// （门、玩家、出生点等）都继承它。
    ///
    /// 基类自动完成：
    /// - 启用/销毁时注册/注销到 <see cref="BackendRegistry"/>；
    /// - 提供统一的对象 ID（ObjectId，子类可覆写）；
    /// - 提供向后台发送消息、世界坐标转图片归一化坐标的工具。
    ///
    /// 子类通过 <see cref="AppendToReport"/> 把自身信息加入上报消息，
    /// 由注册表在连接建立时统一上报；后台命令经 ServerCommandDispatcher 按 ObjectId 定位。
    /// </summary>
    public abstract class BackendObject : MonoBehaviour
    {
        /// <summary>后台使用的唯一对象 ID（子类覆写：Door 用 doorId、Player 用 PlayerId、SpawnPoint 用 id）。</summary>
        public virtual string ObjectId => name;

        protected virtual void OnEnable()
        {
            BackendRegistry.Instance.Register(this);
        }

        protected virtual void OnDisable()
        {
            var registry = BackendRegistry.Instance;
            if (registry != null)
            {
                registry.Unregister(this);
            }
        }

        /// <summary>
        /// 把自身信息追加到上报消息：
        /// 门/出生点加入地图对象消息，玩家加入玩家名单消息。
        /// </summary>
        public abstract void AppendToReport(
            Server.RegisterMapObjectsMessage mapObjects,
            Server.RegisterPlayersMessage players);

        /// <summary>向后台发送一条消息（JSON 自动序列化）。</summary>
        protected void SendToBackend(object message)
        {
            var connection = Server.ServerConnection.Instance;
            if (connection != null && connection.IsConnected)
            {
                connection.Send(message);
            }
        }

        /// <summary>把世界坐标换算为当前地图图片的归一化坐标（y 向下，左上角为原点）。</summary>
        protected Server.Position NormalizePosition(Vector3 worldPosition)
        {
            var mapManager = Object.FindFirstObjectByType<MapManager>();
            if (mapManager == null)
            {
                return new Server.Position { x = 0.5f, y = 0.5f };
            }

            return mapManager.GetNormalizedPosition(worldPosition);
        }
    }
}
