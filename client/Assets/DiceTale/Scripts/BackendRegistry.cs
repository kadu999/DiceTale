using System.Collections.Generic;
using UnityEngine;

namespace DiceTale
{
    /// <summary>
    /// 后台对象注册表：收集场景中所有 <see cref="BackendObject"/>，
    /// 在后台连接建立/地图变化时统一组装并上报（门、出生点、玩家名单）。
    /// </summary>
    public class BackendRegistry : MonoBehaviour
    {
        private static BackendRegistry instance;

        public static BackendRegistry Instance
        {
            get
            {
                if (instance == null)
                {
                    var go = new GameObject(nameof(BackendRegistry));
                    instance = go.AddComponent<BackendRegistry>();
                }

                return instance;
            }
        }

        private readonly List<BackendObject> objects = new List<BackendObject>();

        private void Awake()
        {
            if (instance != null && instance != this)
            {
                Destroy(gameObject);
                return;
            }

            instance = this;
        }

        private void OnDestroy()
        {
            if (instance == this)
            {
                instance = null;
            }
        }

        public void Register(BackendObject obj)
        {
            if (obj != null && !objects.Contains(obj))
            {
                objects.Add(obj);
            }
        }

        public void Unregister(BackendObject obj)
        {
            objects.Remove(obj);
        }

        /// <summary>
        /// 统一向后台上报所有已注册对象：
        /// 门/出生点 → register_map_objects，玩家 → register_players。
        /// </summary>
        public void ReportAll()
        {
            var connection = Server.ServerConnection.Instance;
            if (connection == null || !connection.IsConnected)
            {
                return;
            }

            var mapManager = Object.FindFirstObjectByType<MapManager>();
            var mapMsg = new Server.RegisterMapObjectsMessage
            {
                mapName = mapManager != null ? mapManager.CurrentMapName : null
            };
            var playerMsg = new Server.RegisterPlayersMessage();

            foreach (var obj in objects)
            {
                if (obj == null)
                {
                    continue;
                }

                obj.AppendToReport(mapMsg, playerMsg);

                // 通用对象状态信息：所有 BackendObject 统一上报，供 GM 页面展示与切换状态
                mapMsg.objects.Add(new Server.ServerObjectInfo
                {
                    id = obj.ObjectId,
                    name = obj.DisplayName,
                    kind = obj.ObjectKind,
                    currentState = obj.CurrentStateName,
                    states = obj.StateNames,
                    position = obj.GetNormalizedPosition(),
                    items = new List<string>(obj.Items)
                });
            }

            if (!string.IsNullOrEmpty(mapMsg.mapName))
            {
                connection.Send(mapMsg);
            }

            if (playerMsg.players.Count > 0)
            {
                connection.Send(playerMsg);
            }
        }
    }
}
