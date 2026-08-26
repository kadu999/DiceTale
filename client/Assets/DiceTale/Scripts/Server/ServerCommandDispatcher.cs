using System;
using System.Collections.Generic;
using UnityEngine;

namespace DiceTale.Server
{
    /// <summary>
    /// 解析并执行服务器下发的命令：
    /// sync_state / set_map / teleport_player / set_object_state。
    /// </summary>
    public class ServerCommandDispatcher : MonoBehaviour
    {
        public void Dispatch(string json)
        {
            try
            {
                var msg = JsonParser.ParseObject(json);
                if (msg == null)
                {
                    return;
                }

                switch (JsonParser.GetString(msg, "type"))
                {
                    case "set_object_state":
                        HandleSetObjectState(msg);
                        break;
                    case "teleport_player":
                        HandleTeleportPlayer(msg);
                        break;
                    case "set_map":
                        HandleSetMap(msg);
                        break;
                    case "sync_state":
                        HandleSyncState(msg);
                        break;
                    default:
                        Debug.LogWarning($"[ServerCommandDispatcher] Unknown command: {JsonParser.GetString(msg, "type")}");
                        break;
                }
            }
            catch (Exception ex)
            {
                Debug.LogError($"[ServerCommandDispatcher] Failed to dispatch: {ex.Message}");
            }
        }

        /// <summary>set_object_state：按 ObjectId 定位后台对象，按名称切换其状态，并打印结果。</summary>
        private void HandleSetObjectState(Dictionary<string, object> msg)
        {
            var objectId = JsonParser.GetString(msg, "objectId");
            var stateName = JsonParser.GetString(msg, "state");
            var obj = FindBackendObject(objectId);
            if (obj == null)
            {
                Debug.LogWarning($"[ServerCommandDispatcher] BackendObject not found in scene: {objectId}");
                return;
            }

            if (obj.TrySetState(stateName))
            {
                Debug.Log($"[ServerCommandDispatcher] {objectId} ({obj.DisplayName}): state -> '{stateName}' OK");
            }
            else
            {
                Debug.LogWarning($"[ServerCommandDispatcher] {objectId}: unknown state '{stateName}'");
            }
        }

        private void HandleTeleportPlayer(Dictionary<string, object> msg)
        {
            var mapName = JsonParser.GetString(msg, "mapName");
            var spawnId = JsonParser.GetString(msg, "spawnId");
            var mapManager = UnityEngine.Object.FindFirstObjectByType<MapManager>();
            mapManager?.LoadMap(mapName, spawnId);
        }

        private void HandleSetMap(Dictionary<string, object> msg)
        {
            var mapName = JsonParser.GetString(msg, "mapName");
            var spawnId = JsonParser.GetString(msg, "spawnId");
            var mapManager = UnityEngine.Object.FindFirstObjectByType<MapManager>();
            mapManager?.LoadMap(mapName, spawnId);
        }

        private void HandleSyncState(Dictionary<string, object> msg)
        {
            var state = JsonParser.GetObject(msg, "state");
            if (state == null)
            {
                return;
            }

            var currentMap = JsonParser.GetString(state, "currentMap");
            var mapManager = UnityEngine.Object.FindFirstObjectByType<MapManager>();
            if (!string.IsNullOrEmpty(currentMap) && mapManager != null)
            {
                mapManager.LoadMap(currentMap);
            }
        }

        private BackendObject FindBackendObject(string objectId)
        {
            foreach (var obj in UnityEngine.Object.FindObjectsByType<BackendObject>(FindObjectsSortMode.None))
            {
                if (obj.ObjectId == objectId)
                {
                    return obj;
                }
            }

            return null;
        }
    }
}
