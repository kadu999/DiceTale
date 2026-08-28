using System.Collections.Generic;
using UnityEngine;

namespace DiceTale
{
    /// <summary>
    /// 后台对象注册表：收集场景中所有 <see cref="BackendObject"/>，
    /// 在后台连接建立/地图变化时统一组装并上报（物体、出生点、玩家名单）。
    /// </summary>
    public class BackendRegistry : MonoBehaviour
    {
        private static BackendRegistry instance;
        /// <summary>是否已创建过注册表（销毁后不再重建，避免场景关闭时从 OnDisable/OnDestroy 泄漏新对象）。</summary>
        private static bool created;

        public static BackendRegistry Instance
        {
            get
            {
                if (instance == null && !created)
                {
                    created = true;
                    var go = new GameObject(nameof(BackendRegistry));
                    DontDestroyOnLoad(go); // 常驻单例：与 ServerConnection 一致，不随场景关闭重建
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
        /// 物体/出生点 → register_map_objects，玩家 → register_players。
        /// </summary>
        public void ReportAll()
        {
            var connection = Server.ServerConnection.Instance;
            if (connection == null || !connection.IsConnected)
            {
                return;
            }

            var mapManager = Object.FindFirstObjectByType<MapManager>();
            var mapName = mapManager != null ? mapManager.CurrentMapName : null;
            var mapMsg = new Server.RegisterMapObjectsMessage
            {
                mapName = mapName
            };
            var playerMsg = new Server.RegisterPlayersMessage();

            foreach (var obj in objects)
            {
                if (obj == null)
                {
                    continue;
                }

                // 只上报当前世界的物体：切图时旧地图物体在帧末才销毁（Destroy 延迟），
                // 残留物体会把旧地图的对象混进上报，造成后台跨图串图
                if (mapManager != null && mapManager.IsFromOtherMap(obj.transform))
                {
                    continue;
                }

                obj.AppendToReport(mapMsg, playerMsg);

                // 通用对象状态信息：枢纽只填身份/位置/组件清单；
                // 能力数据（状态/物品/道具/遮罩）由各能力组件自己填充（IBackendComponentData）
                var info = new Server.ServerObjectInfo
                {
                    id = obj.ObjectId,
                    name = obj.DisplayName,
                    kind = obj.ObjectKind,
                    mapName = mapName,
                    position = obj.GetNormalizedPosition(),
                    components = obj.Components
                };

                foreach (var comp in obj.CapabilityComponents)
                {
                    if (comp is IBackendComponentData data)
                    {
                        data.AppendToInfo(info);
                    }
                }

                mapMsg.objects.Add(info);
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
