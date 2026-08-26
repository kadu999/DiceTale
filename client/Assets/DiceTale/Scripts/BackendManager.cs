using UnityEngine;

namespace DiceTale
{
    /// <summary>
    /// 后端入口：默认连接权威服务器（WebSocket），可切回本地 Mock 便于离线调试。
    /// </summary>
    public class BackendManager : MonoBehaviour
    {
        public static BackendManager Instance { get; private set; }

        [SerializeField]
        private bool useServer = true;

        [SerializeField]
        private string serverUrl = "ws://localhost:8080/client";

        private IBackendService service;

        private void Awake()
        {
            Instance = this;

            if (useServer)
            {
                var connection = gameObject.AddComponent<Server.ServerConnection>();
                connection.DefaultUrl = serverUrl;

                var dispatcher = gameObject.AddComponent<Server.ServerCommandDispatcher>();
                connection.OnMessage += dispatcher.Dispatch;

                service = new WebSocketBackendService();
                ((WebSocketBackendService)service).SubscribeToConnection(connection);

                connection.Connect(serverUrl);
            }
            else
            {
                service = new MockBackendService();
            }
        }

        public void RequestDoorAccess(string doorId, System.Action<bool> callback)
        {
            if (service == null)
            {
                callback?.Invoke(true);
                return;
            }

            service.RequestDoorAccess(doorId, callback);
        }
    }
}
