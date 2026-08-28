using System;
using System.Collections;
using System.Collections.Concurrent;
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
        public string DefaultUrl = "ws://localhost:8088/client";

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

        /// <summary>
        /// 收到的原始消息队列：接收循环在后台线程入队，Update 在主线程统一分发
        /// （命令处理里全是 Unity API，必须在主线程执行，否则会静默失败）。
        /// </summary>
        private readonly ConcurrentQueue<string> pendingMessages = new ConcurrentQueue<string>();

        private void Update()
        {
            while (pendingMessages.TryDequeue(out var json))
            {
                OnMessage?.Invoke(json);
            }
        }

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
                StartCoroutine(HeartbeatCoroutine()); // 应用层心跳，供后台存活检测
                OnConnected?.Invoke();
            }
            catch (Exception ex)
            {
                Debug.LogWarning($"[ServerConnection] Connect failed: {ex.Message}");
                await CloseAsync();
                ScheduleReconnect();
            }
        }

        /// <summary>串行发送链：ClientWebSocket 不允许并发 SendAsync，排队逐个发送，避免后续消息被丢弃。</summary>
        private Task sendChain = Task.CompletedTask;

        public void Send<T>(T message) where T : class
        {
            if (!IsConnected) return;

            var json = JsonUtility.ToJson(message);
            var bytes = Encoding.UTF8.GetBytes(json);
            var segment = new ArraySegment<byte>(bytes);

            sendChain = sendChain.ContinueWith(
                _ => SendAsyncInternal(segment),
                CancellationToken.None,
                TaskContinuationOptions.ExecuteSynchronously,
                TaskScheduler.Default);
        }

        private async Task SendAsyncInternal(ArraySegment<byte> segment)
        {
            try
            {
                if (webSocket != null && webSocket.State == WebSocketState.Open)
                {
                    await webSocket.SendAsync(segment, WebSocketMessageType.Text, true, cts.Token);
                }
            }
            catch (OperationCanceledException)
            {
                // 主动关闭，忽略
            }
            catch (Exception ex)
            {
                Debug.LogWarning($"[ServerConnection] Send failed: {ex.Message}");
            }
        }

        /// <summary>应用层心跳间隔（秒）：后台据此判断连接是否半开并清理死连接。</summary>
        private const float HeartbeatInterval = 15f;

        private IEnumerator HeartbeatCoroutine()
        {
            var wait = new WaitForSeconds(HeartbeatInterval);
            // 断线后自动退出；重连时 Connect() 会重新启动一个协程
            while (IsConnected)
            {
                yield return wait;
                Send(new HeartbeatMessage());
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
            try
            {
                while (webSocket != null && webSocket.State == WebSocketState.Open)
                {
                    var json = await ReceiveOneMessage();
                    if (json == null)
                    {
                        break; // 收到 Close
                    }

                    pendingMessages.Enqueue(json); // 入队，由主线程 Update 分发 OnMessage
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

        /// <summary>
        /// 接收一条完整 WebSocket 消息：累积接收直到 EndOfMessage，缓冲不足时自动翻倍扩容。
        /// 支持大消息（如遮罩图 PNG base64），避免固定 64KB 缓冲截断消息、
        /// 残留字节冲歪后续消息导致客户端停止更新。返回 null 表示连接关闭。
        /// </summary>
        private async Task<string> ReceiveOneMessage()
        {
            var buffer = new byte[65536];
            var offset = 0;
            while (true)
            {
                if (offset == buffer.Length)
                {
                    Array.Resize(ref buffer, buffer.Length * 2); // 扩容
                }

                var result = await webSocket.ReceiveAsync(
                    new ArraySegment<byte>(buffer, offset, buffer.Length - offset), cts.Token);
                if (result.MessageType == WebSocketMessageType.Close)
                {
                    return null;
                }

                offset += result.Count;
                if (result.EndOfMessage)
                {
                    return Encoding.UTF8.GetString(buffer, 0, offset);
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
