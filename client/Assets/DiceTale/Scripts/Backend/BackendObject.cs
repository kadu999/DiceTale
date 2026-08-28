using System.Collections.Generic;
using UnityEngine;

namespace DiceTale
{
    /// <summary>
    /// 后台对象枢纽（组件模型）：挂在物体（主体）上的「后台对象」本体，只负责与后台（backend）的通信、身份与聚合，
    /// 具体能力（状态机 / 物品 / 道具货源 / 遮罩 / 角色名单）由同一主体上的能力组件实现
    /// <see cref="IBackendRole"/>、<see cref="IBackendDisplayName"/>、<see cref="ISceneStateMachine"/>、
    /// <see cref="IItemInventory"/>、<see cref="IItemStock"/>、<see cref="IMaskSource"/> 提供。
    ///
    /// 主体 = 挂了本枢纽的 GameObject；能力组件挂在同一个主体上。枢纽在初始化（OnEnable）时
    /// 扫描一次缓存能力组件列表（不序列化、不显示、不对外暴露），聚合上报与命令转发都以该缓存为来源。
    ///
    /// 枢纽自动完成：
    /// - 启用/销毁时注册/注销到 <see cref="BackendRegistry"/>；
    /// - 提供统一的对象 ID（ObjectId：角色组件优先，其次自定义 ID（隐藏字段），默认自动生成唯一 ID）与类型显示名（ObjectKind）；
    /// - 提供向后台发送消息、世界坐标转图片归一化坐标的工具；
    /// - 收集能力组件的数据统一上报（各能力组件经 <see cref="IBackendComponentData"/> 自己填充状态/物品/道具/遮罩字段）；
    /// - 通用命令路由：后台命令按类型转发给能处理它的能力组件（组件实现 <see cref="IBackendCommandHandler"/> 自己解析并执行）；
    ///
    /// 用法：主体（GameObject）上挂枢纽 + 任意组合的能力组件（门=枢纽+状态机、道具=枢纽+道具货源、
    /// 玩家=枢纽+角色+物品、宝箱=枢纽+状态机+道具货源…）。
    /// 后台命令经 ServerCommandDispatcher 按 ObjectId 定位枢纽。
    /// </summary>
    [DisallowMultipleComponent]
    public class BackendObject : MonoBehaviour
    {
        private static readonly List<string> EmptyItems = new List<string>();

        [SerializeField, Tooltip("后台对象类型（GM 页面分类展示用；新增类型在 BackendObjectKind 末尾追加）")]
        private BackendObjectKind objectKind = BackendObjectKind.SceneObject;

        [SerializeField, Tooltip("GM 页面显示的名称（后台看名字识别对象）；为空时回退道具动态显示名或对象 ID")]
        private string displayName;

        [SerializeField, HideInInspector, Tooltip("自定义对象 ID 覆盖（高级用途：需要稳定/可读 ID 时设置，如 Debug 模式或代码里写入）；为空时自动生成唯一 ID；Player/SpawnPoint 用角色组件自己的 ID")]
        private string objectId;

        private string generatedId;

        /// <summary>主体上的能力组件缓存（初始化时扫描获取，不序列化不显示）；上报与命令路由以此列表为来源。</summary>
        private readonly List<BackendComponent> capabilityComponents = new List<BackendComponent>();

        /// <summary>后台使用的唯一对象 ID：角色组件（Player/SpawnPoint）优先，其次自定义 ID（隐藏字段），默认自动生成唯一 ID。</summary>
        public string ObjectId
        {
            get
            {
                var role = FindComponent<IBackendRole>();
                if (role != null)
                {
                    return role.ObjectId;
                }

                if (!string.IsNullOrEmpty(objectId))
                {
                    return objectId;
                }

                if (generatedId == null)
                {
                    generatedId = $"{name}_{System.Guid.NewGuid():N}";
                }

                return generatedId;
            }
        }

        /// <summary>对象类型显示名（GM 页面展示用）：序列化 BackendObjectKind 枚举的字符串形式。</summary>
        public string ObjectKind => objectKind.ToString();

        /// <summary>GM 页面显示的名称：优先静态显示名（本枢纽），其次道具动态显示名（ItemObject「道具名 ×剩余」），回退对象 ID。</summary>
        public string DisplayName
        {
            get
            {
                if (!string.IsNullOrEmpty(displayName))
                {
                    return displayName;
                }

                var display = FindComponent<IBackendDisplayName>();
                if (display != null)
                {
                    var dynamicName = display.DisplayName;
                    if (!string.IsNullOrEmpty(dynamicName))
                    {
                        return dynamicName;
                    }
                }

                return ObjectId;
            }
        }

        /// <summary>主体上的能力组件（只读视图；数据由各组件自己持有并上报）。</summary>
        /// <summary>
        /// 可编辑能力清单（上报给 GM 页面，据此渲染属性控件）：取每个能力组件自己的 ComponentId；
        /// 角色组件（Player/SpawnPoint）GmEditable=false，不进入清单（按 kind 与 register_players/spawnPoints 名单处理）。
        /// </summary>
        public List<string> Components
        {
            get
            {
                var components = new List<string>();
                foreach (var comp in capabilityComponents)
                {
                    if (comp == null || !comp.GmEditable)
                    {
                        continue;
                    }

                    components.Add(comp.ComponentId);
                }

                return components;
            }
        }

        private void OnEnable()
        {
            RefreshCapabilityComponents();
            BackendRegistry.Instance.Register(this);
        }

        private void OnDisable()
        {
            var registry = BackendRegistry.Instance;
            if (registry != null)
            {
                registry.Unregister(this);
            }
        }

        /// <summary>重新扫描主体上的能力组件并同步缓存（初始化/启用时自动调用；运行时动态 AddComponent 后也可手动调用）。
        /// 能力组件统一继承 <see cref="BackendComponent"/>，扫描即全量。 </summary>
        public void RefreshCapabilityComponents()
        {
            capabilityComponents.Clear();
            foreach (var comp in GetComponents<BackendComponent>())
            {
                if (comp != null)
                {
                    capabilityComponents.Add(comp);
                }
            }
        }

        /// <summary>填充 GM 上报信息的能力数据：遍历能力组件调用 <see cref="IBackendComponentData.AppendToInfo"/>
        /// （组件自己填自己的字段，本处不关心任何具体字段）。</summary>
        public void FillReportData(Server.ServerObjectInfo info)
        {
            foreach (var comp in capabilityComponents)
            {
                if (comp is IBackendComponentData data)
                {
                    data.AppendToInfo(info);
                }
            }
        }

        /// <summary>从能力组件列表找第一个实现指定接口的组件（无则返回 null；已销毁的引用直接跳过）。</summary>
        private T FindComponent<T>() where T : class
        {
            foreach (var comp in capabilityComponents)
            {
                if (comp == null)
                {
                    continue;
                }

                if (comp is T t)
                {
                    return t;
                }
            }

            return null;
        }

        /// <summary>
        /// 把自身信息追加到上报消息：角色组件（Player 玩家名单、SpawnPoint 出生点）追加专用字段，
        /// 通用状态信息已由注册表统一加入 objects（本枢纽聚合各能力组件）。
        /// </summary>
        public void AppendToReport(
            Server.RegisterMapObjectsMessage mapObjects,
            Server.RegisterPlayersMessage players)
        {
            var role = FindComponent<IBackendRole>();
            if (role != null)
            {
                role.AppendToReport(mapObjects, players);
            }
        }

        /// <summary>
        /// 命令路由（通用）：把后台命令转发给能处理它的能力组件——组件实现
        /// <see cref="IBackendCommandHandler"/>，自己解析参数并执行；本处不写任何具体命令逻辑，
        /// 新增命令只需在对应组件实现接口，无需改动主体与分派器。
        /// </summary>
        /// <param name="commandType">后台消息 type（如 "set_object_state"）。</param>
        /// <param name="msg">后台消息字典（组件自己解析参数）。</param>
        /// <returns>有组件处理并执行成功返回 true；无组件处理返回 false。</returns>
        public bool DispatchCommand(string commandType, Dictionary<string, object> msg)
        {
            if (string.IsNullOrEmpty(commandType) || msg == null)
            {
                return false;
            }

            foreach (var comp in capabilityComponents)
            {
                if (comp == null || !(comp is IBackendCommandHandler handler))
                {
                    continue;
                }

                if (handler.CanHandle(commandType))
                {
                    return handler.HandleCommand(msg);
                }
            }

            return false;
        }

        /// <summary>状态切换后上报给后台，使 GM 页面同步显示当前状态（状态机组件切换状态后调用）。</summary>
        public void ReportStateChanged()
        {
            var stateMachine = FindComponent<ISceneStateMachine>();
            var stateName = stateMachine != null ? stateMachine.CurrentStateName : null;
            if (string.IsNullOrEmpty(stateName))
            {
                return;
            }

            SendToBackend(new Server.ReportObjectStateMessage
            {
                objectId = ObjectId,
                state = stateName
            });
        }

        /// <summary>物品列表变化后上报给后台（物品组件在增删物品后调用）。</summary>
        public void ReportItems()
        {
            var inventory = FindComponent<IItemInventory>();
            var items = inventory != null ? inventory.Items : (IReadOnlyList<string>)EmptyItems;
            SendToBackend(new Server.ReportObjectItemsMessage
            {
                objectId = ObjectId,
                items = new List<string>(items)
            });
        }

        /// <summary>向后台发送一条消息（JSON 自动序列化）。</summary>
        public void SendToBackend(object message)
        {
            var connection = Server.ServerConnection.Instance;
            if (connection != null && connection.IsConnected)
            {
                connection.Send(message);
            }
        }

        /// <summary>对象自身位置的归一化坐标（上报给 GM 页面在地图上定位目标）。</summary>
        public Server.Position GetNormalizedPosition()
        {
            return NormalizePosition(transform.position);
        }

        /// <summary>把世界坐标换算为当前地图图片的归一化坐标（y 向下，左上角为原点）。</summary>
        public Server.Position NormalizePosition(Vector3 worldPosition)
        {
            var mapManager = Object.FindFirstObjectByType<MapManager>();
            if (mapManager == null)
            {
                return new Server.Position { x = 0.5f, y = 0.5f };
            }

            return mapManager.GetNormalizedPosition(worldPosition);
        }
    }
}
