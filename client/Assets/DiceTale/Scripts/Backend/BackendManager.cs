using UnityEngine;

namespace DiceTale
{
    /// <summary>
    /// 后端入口：创建到权威服务器的连接与命令分发（WebSocket）。
    /// 对象状态由 OptionValue 选项组件（经 BackendObject 通信层）统一上报与控制，无需本地服务层。
    /// </summary>
    public class BackendManager : MonoBehaviour
    {
        public static BackendManager Instance { get; private set; }

        [SerializeField]
        private bool useServer = true;

        [SerializeField]
        private string serverUrl = "ws://localhost:8088/client";

        private void Awake()
        {
            Instance = this;

            if (useServer)
            {
                var connection = gameObject.AddComponent<Server.ServerConnection>();
                connection.DefaultUrl = serverUrl;

                var dispatcher = gameObject.AddComponent<Server.ServerCommandDispatcher>();
                connection.OnMessage += dispatcher.Dispatch;

                connection.Connect(serverUrl);
            }
        }
    }
}
