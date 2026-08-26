using System;
using System.Collections.Generic;
using UnityEngine;

namespace DiceTale.Server
{
    /// <summary>
    /// 解析并执行服务器下发的命令：
    /// sync_state / set_map / set_door_state / teleport_player。
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
                    case "set_door_state":
                        HandleSetDoorState(msg);
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

        private void HandleSetDoorState(Dictionary<string, object> msg)
        {
            var doorId = JsonParser.GetString(msg, "doorId");
            var unlocked = JsonParser.GetBool(msg, "unlocked");
            var door = FindDoor(doorId);
            if (door == null)
            {
                Debug.LogWarning($"[ServerCommandDispatcher] Door not found in scene: {doorId}");
                return;
            }

            door.SetUnlocked(unlocked);
        }

        private void HandleTeleportPlayer(Dictionary<string, object> msg)
        {
            var mapName = JsonParser.GetString(msg, "mapName");
            var spawnId = JsonParser.GetString(msg, "spawnId");
            var mapManager = Object.FindFirstObjectByType<MapManager>();
            mapManager?.LoadMap(mapName, spawnId);
        }

        private void HandleSetMap(Dictionary<string, object> msg)
        {
            var mapName = JsonParser.GetString(msg, "mapName");
            var spawnId = JsonParser.GetString(msg, "spawnId");
            var mapManager = Object.FindFirstObjectByType<MapManager>();
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
            var mapManager = Object.FindFirstObjectByType<MapManager>();
            if (!string.IsNullOrEmpty(currentMap) && mapManager != null)
            {
                mapManager.LoadMap(currentMap);
            }

            var doors = JsonParser.GetObject(state, "doors");
            if (doors != null)
            {
                foreach (var pair in doors)
                {
                    var doorState = pair.Value as Dictionary<string, object>;
                    if (doorState == null)
                    {
                        continue;
                    }

                    var door = FindDoor(pair.Key);
                    door?.SetUnlocked(JsonParser.GetBool(doorState, "unlocked"));
                }
            }
        }

        private Door FindDoor(string doorId)
        {
            foreach (var door in Object.FindObjectsByType<Door>(FindObjectsSortMode.None))
            {
                if (door.DoorId == doorId)
                {
                    return door;
                }
            }

            return null;
        }
    }
}
