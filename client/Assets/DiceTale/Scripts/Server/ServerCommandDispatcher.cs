using System;
using System.Collections.Generic;
using UnityEngine;

namespace DiceTale.Server
{
    /// <summary>
    /// 解析并执行服务器下发的命令：
    /// sync_state / set_map / teleport_player / set_object_state / set_object_items / set_mask_image / erase_mask。
    /// 对象命令按 ObjectId 定位枢纽后，由枢纽路由给对应能力组件处理（组件自己解析参数）。
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
                    case "set_object_items":
                    case "set_mask_image":
                    case "erase_mask":
                        HandleObjectCommand(msg);
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

        /// <summary>
        /// 对象命令（set_object_state / set_object_items / set_mask_image / erase_mask）：
        /// 按 ObjectId 定位枢纽，由枢纽通用路由给能处理该命令的能力组件（组件自己解析参数并执行）。
        /// </summary>
        private void HandleObjectCommand(Dictionary<string, object> msg)
        {
            var objectId = JsonParser.GetString(msg, "objectId");
            var obj = FindBackendObject(objectId);
            if (obj == null)
            {
                Debug.LogWarning($"[ServerCommandDispatcher] BackendObject not found in scene: {objectId}");
                return;
            }

            var type = JsonParser.GetString(msg, "type");
            if (obj.DispatchCommand(type, msg))
            {
                Debug.Log($"[ServerCommandDispatcher] {objectId} ({obj.DisplayName}): {type} OK");
            }
            else
            {
                Debug.LogWarning($"[ServerCommandDispatcher] {objectId}: no component handled command '{type}'");
            }

            // 玩家物品变化后刷新道具剩余数量并重报（GM 页面「剩余」随之更新）
            if (type == "set_object_items")
            {
                ItemObject.RefreshAllQuantities();
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
