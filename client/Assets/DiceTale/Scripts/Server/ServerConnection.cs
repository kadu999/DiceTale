using System;
using System.Collections;
using System.Net.WebSockets;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using UnityEngine;

namespace DiceTale.Server
{
    /// <summary>
    /// 管理到 DiceTale 权威服务器的 WebSocket 连接生命周期（连接、断开、自动重连）。
    /// 收到消息后通过 <see cref="OnMessage"/> 广播原始 JSON。
    /// </summary>
    public class ServerConnection : MonoBehaviour
    {
        public static ServerConnection Instance { get; private set; }

        [Tooltip("服务器 WebSocket 地址（客户端通道）")]
        public string DefaultUrl = "ws://localhost:8080/client";

        [Tooltip("断线后是否自动重连")]
        public bool AutoReconnect = true;

        [Tooltip("重连间隔（秒）")]
        public float ReconnectDelay = 5f;

        /// <summary>收到服务器消息（原始 JSON 字符串）。</summary>
        public event Action<string> OnMessage;

        /// <summary>成功建立连接并发送 request_join 后触发。</summary>
        public event Action OnConnected;

        public bool IsConnected => webSocket != null && webSocket.State == WebSocketState.Open;

        private ClientWebSocket webSocket;
        private CancellationTokenSource cts;
        private bool closing;
        private bool reconnecting;

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }

            Instance = this;
            DontDestroyOnLoad(gameObject);
        }

        public async void Connect(string url = null)
        {
            if (webSocket != null)
            {
                await CloseAsync();
            }

            closing = false;
            webSocket = new ClientWebSocket();
            cts = new CancellationTokenSource();

            try
            {
                await webSocket.ConnectAsync(new Uri(url ?? DefaultUrl), cts.Token);
                if (webSocket.State != WebSocketState.Open)
                {
                    throw new Exception("Connection not open after ConnectAsync");
                }

                _ = ReceiveLoop();
                SendJoin();
                OnConnected?.Invoke();
            }
            catch (Exception ex)
            {
                Debug.LogWarning($"[ServerConnection] Connect failed: {ex.Message}");
                await CloseAsync();
                ScheduleReconnect();
            }
        }

        public void Send<T>(T message) where T : class
        {
            if (!IsConnected) return;

            var json = JsonUtility.ToJson(message);
            var bytes = Encoding.UTF8.GetBytes(json);
            var segment = new ArraySegment<byte>(bytes);
            _ = SendAsync(segment);
        }

        private async Task SendAsync(ArraySegment<byte> segment)
        {
            try
            {
                await webSocket.SendAsync(segment, WebSocketMessageType.Text, true, cts.Token);
            }
            catch (Exception ex)
            {
                Debug.LogWarning($"[ServerConnection] Send failed: {ex.Message}");
            }
        }

        public void Close()
        {
            closing = true;
            _ = CloseAsync();
        }

        private void SendJoin()
        {
            Send(new RequestJoinMessage());
        }

        private async Task ReceiveLoop()
        {
            var buffer = new byte[65536];
            try
            {
                while (webSocket != null && webSocket.State == WebSocketState.Open)
                {
                    var result = await webSocket.ReceiveAsync(new ArraySegment<byte>(buffer), cts.Token);
                    if (result.MessageType == WebSocketMessageType.Close)
                    {
                        break;
                    }

                    var json = Encoding.UTF8.GetString(buffer, 0, result.Count);
                    OnMessage?.Invoke(json);
                }
            }
            catch (OperationCanceledException)
            {
                // 主动关闭，忽略
            }
            catch (Exception ex)
            {
                Debug.LogWarning($"[ServerConnection] Receive error: {ex.Message}");
            }
            finally
            {
                await CloseAsync();
                if (!closing)
                {
                    ScheduleReconnect();
                }
            }
        }

        private void ScheduleReconnect()
        {
            if (!AutoReconnect || closing || reconnecting || !isActiveAndEnabled)
            {
                return;
            }

            reconnecting = true;
            StartCoroutine(ReconnectCoroutine());
        }

        private IEnumerator ReconnectCoroutine()
        {
            yield return new WaitForSeconds(ReconnectDelay);
            reconnecting = false;
            Connect();
        }

        private async Task CloseAsync()
        {
            if (webSocket == null) return;

            try
            {
                cts?.Cancel();
                if (webSocket.State == WebSocketState.Open)
                {
                    await webSocket.CloseAsync(WebSocketCloseStatus.NormalClosure, "Closing", CancellationToken.None);
                }
            }
            catch (Exception ex)
            {
                Debug.LogWarning($"[ServerConnection] Close error: {ex.Message}");
            }
            finally
            {
                webSocket?.Dispose();
                webSocket = null;
            }
        }

        private void OnDestroy()
        {
            closing = true;
            cts?.Cancel();
            _ = CloseAsync();
        }
    }
}
