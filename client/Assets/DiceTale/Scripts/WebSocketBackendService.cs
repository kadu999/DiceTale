using System;
using System.Collections.Generic;
using DiceTale.Server;
using UnityEngine;

namespace DiceTale
{
    /// <summary>
    /// IBackendService 的 WebSocket 实现：通过 ServerConnection 向权威服务器
    /// 请求开门权限，收到 set_door_state 命令后回调。
    /// </summary>
    public class WebSocketBackendService : IBackendService
    {
        private readonly Dictionary<string, Action<bool>> pendingDoorCallbacks = new Dictionary<string, Action<bool>>();
        private ServerConnection connection;

        public void SubscribeToConnection(ServerConnection conn)
        {
            if (connection != null)
            {
                connection.OnMessage -= OnMessage;
            }

            connection = conn;
            if (connection != null)
            {
                connection.OnMessage += OnMessage;
            }
        }

        public void RequestDoorAccess(string doorId, Action<bool> callback)
        {
            if (connection == null || !connection.IsConnected)
            {
                Debug.LogWarning("[WebSocketBackendService] Not connected, allowing local fallback.");
                callback?.Invoke(true);
                return;
            }

            pendingDoorCallbacks[doorId] = callback;
            connection.Send(new RequestDoorAccessMessage { doorId = doorId });
        }

        private void OnMessage(string json)
        {
            var msg = JsonParser.ParseObject(json);
            if (msg == null)
            {
                return;
            }

            var type = JsonParser.GetString(msg, "type");
            if (type == "set_door_state")
            {
                var doorId = JsonParser.GetString(msg, "doorId");
                var unlocked = JsonParser.GetBool(msg, "unlocked");
                if (pendingDoorCallbacks.TryGetValue(doorId, out var callback))
                {
                    pendingDoorCallbacks.Remove(doorId);
                    callback?.Invoke(unlocked);
                }
            }
            else if (type == "teleport_player")
            {
                // 服务器下发传送 = 已放行。传送门不会回 set_door_state，
                // 这里清空挂起回调，避免字典泄漏（MVP 单玩家）。
                var pending = new List<Action<bool>>(pendingDoorCallbacks.Values);
                pendingDoorCallbacks.Clear();
                foreach (var callback in pending)
                {
                    callback?.Invoke(true);
                }
            }
        }
    }
}
