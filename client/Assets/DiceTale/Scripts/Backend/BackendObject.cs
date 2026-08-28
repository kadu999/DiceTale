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
    /// 主体 = 挂了本枢纽的 GameObject；能力组件挂在同一个主体上。枢纽维护「能力组件列表」
    /// （Inspector 可见，挂/摘能力组件时自动同步），聚合上报与命令转发都以该列表为唯一来源，
    /// 无需逐个 GetComponent 探测。
    ///
    /// 枢纽自动完成：
    /// - 启用/销毁时注册/注销到 <see cref="BackendRegistry"/>；
    /// - 提供统一的对象 ID（ObjectId：角色组件优先，其次自定义 ID（隐藏字段），默认自动生成唯一 ID）与类型显示名（ObjectKind）；
    /// - 提供向后台发送消息、世界坐标转图片归一化坐标的工具；
    /// - 聚合能力组件的信息统一上报（状态/物品/道具/遮罩/角色名单）；
    /// - 转发后台命令到对应能力组件（TrySetState → ISceneStateMachine、SetItems → IItemInventory、
    ///   ApplyMaskImage/ApplyEraseStroke → IMaskSource）。
    ///
    /// 用法：主体（GameObject）上挂枢纽 + 任意组合的能力组件（门=枢纽+状态机、道具=枢纽+道具货源、
    /// 玩家=枢纽+角色+物品、宝箱=枢纽+状态机+道具货源…）。
    /// 后台命令经 ServerCommandDispatcher 按 ObjectId 定位枢纽。
    /// </summary>
    [DisallowMultipleComponent]
    public class BackendObject : MonoBehaviour
    {
        private static readonly List<string> EmptyStates = new List<string>();
        private static readonly List<string> EmptyItems = new List<string>();

        [SerializeField, Tooltip("后台对象类型（GM 页面分类展示用；新增类型在 BackendObjectKind 末尾追加）")]
        private BackendObjectKind objectKind = BackendObjectKind.SceneObject;

        [SerializeField, Tooltip("GM 页面显示的名称（后台看名字识别对象）；为空时回退道具动态显示名或对象 ID")]
        private string displayName;

        [SerializeField, HideInInspector, Tooltip("自定义对象 ID 覆盖（高级用途：需要稳定/可读 ID 时设置，如 Debug 模式或代码里写入）；为空时自动生成唯一 ID；Player/SpawnPoint 用角色组件自己的 ID")]
        private string objectId;

        private string generatedId;

        /// <summary>
        /// 主体上的能力组件列表（自动同步：编辑器挂/摘能力组件、运行时启用时刷新；勿手动修改）。
        /// 聚合上报与命令转发以此列表为唯一来源。
        /// </summary>
        [SerializeField, Tooltip("主体上的能力组件（自动同步，无需手动维护）")]
        private List<MonoBehaviour> capabilityComponents = new List<MonoBehaviour>();

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

        /// <summary>当前状态名称（无状态机组件时为 null）。</summary>
        public string CurrentStateName => FindComponent<ISceneStateMachine>()?.CurrentStateName;

        /// <summary>全部可选状态名称（上报给 GM 页面展示与切换；无状态机组件时为空列表）。</summary>
        public List<string> StateNames
        {
            get
            {
                var stateMachine = FindComponent<ISceneStateMachine>();
                return stateMachine != null ? stateMachine.StateNames : EmptyStates;
            }
        }

        /// <summary>物品列表（只读视图；无物品组件时为空列表）。</summary>
        public IReadOnlyList<string> Items
        {
            get
            {
                var inventory = FindComponent<IItemInventory>();
                return inventory != null ? inventory.Items : EmptyItems;
            }
        }

        /// <summary>道具名（有道具货源组件时才有，GM 页面据此展示分配界面；非道具对象返回 null）。</summary>
        public string ItemName => FindComponent<IItemStock>()?.ItemName;

        /// <summary>道具总数量（有道具货源组件时才有，固定库存；非道具对象返回 0）。</summary>
        public int ItemQuantity => FindComponent<IItemStock>()?.ItemQuantity ?? 0;

        /// <summary>遮罩纹理宽度（有遮罩组件时才有，GM 页面据此生成/编辑遮罩；非遮罩对象返回 0）。</summary>
        public int MaskWidth => FindComponent<IMaskSource>()?.MaskWidth ?? 0;

        /// <summary>遮罩纹理高度（有遮罩组件时才有，GM 页面据此生成/编辑遮罩；非遮罩对象返回 0）。</summary>
        public int MaskHeight => FindComponent<IMaskSource>()?.MaskHeight ?? 0;

        /// <summary>
        /// 可编辑能力清单（上报给 GM 页面，据此渲染属性控件；与客户端组件类同名）：
        /// SceneObject 状态机 / ItemInventory 物品 / ItemObject 道具货源 / MaskObject 遮罩。
        /// 角色组件（Player/SpawnPoint）不在此清单——按 kind 与 register_players/spawnPoints 名单处理。
        /// </summary>
        public List<string> Components
        {
            get
            {
                var components = new List<string>();
                foreach (var comp in capabilityComponents)
                {
                    if (comp == null)
                    {
                        continue;
                    }

                    var id = GetComponentId(comp);
                    if (id != null)
                    {
                        components.Add(id);
                    }
                }

                return components;
            }
        }

        private void OnValidate()
        {
            RefreshCapabilityComponents();
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

        /// <summary>重新扫描主体上的能力组件并同步列表（挂/摘能力组件后自动调用；运行时动态 AddComponent 后可手动调用）。</summary>
        public void RefreshCapabilityComponents()
        {
            capabilityComponents.Clear();
            foreach (var comp in GetComponents<MonoBehaviour>())
            {
                if (comp == null || comp == this)
                {
                    continue;
                }

                if (comp is ISceneStateMachine || comp is IItemInventory || comp is IItemStock ||
                    comp is IMaskSource || comp is IBackendRole || comp is IBackendDisplayName)
                {
                    capabilityComponents.Add(comp);
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

        /// <summary>能力组件 → 上报给 GM 的组件名（与客户端组件类同名）；角色/显示名组件不进入上报清单。</summary>
        private static string GetComponentId(MonoBehaviour comp)
        {
            if (comp is ISceneStateMachine)
            {
                return "SceneObject";
            }

            if (comp is IItemInventory)
            {
                return "ItemInventory";
            }

            if (comp is IItemStock)
            {
                return "ItemObject";
            }

            if (comp is IMaskSource)
            {
                return "MaskObject";
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

        /// <summary>后台命令入口：按名称切换状态（转发给状态机组件；无状态机时返回 false）。</summary>
        public bool TrySetState(string stateName)
        {
            var stateMachine = FindComponent<ISceneStateMachine>();
            return stateMachine != null && stateMachine.TrySetState(stateName);
        }

        /// <summary>后台命令入口：整体设置物品列表（转发给物品组件；无物品组件时无操作）。</summary>
        public void SetItems(IEnumerable<string> newItems)
        {
            FindComponent<IItemInventory>()?.SetItems(newItems);
        }

        /// <summary>后台命令入口：应用遮罩图像（base64 PNG；转发给遮罩组件）。</summary>
        public void ApplyMaskImage(string base64Png)
        {
            FindComponent<IMaskSource>()?.ApplyMaskImage(base64Png);
        }

        /// <summary>后台命令入口：应用 GM 擦除的笔画轨迹（归一化点 + 归一化半径 + 软边比例；转发给遮罩组件）。</summary>
        public void ApplyEraseStroke(Vector2[] points, float radius, float softness)
        {
            FindComponent<IMaskSource>()?.ApplyEraseStroke(points, radius, softness);
        }

        /// <summary>状态切换后上报给后台，使 GM 页面同步显示当前状态（状态机组件切换状态后调用）。</summary>
        public void ReportStateChanged()
        {
            var stateName = CurrentStateName;
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
            SendToBackend(new Server.ReportObjectItemsMessage
            {
                objectId = ObjectId,
                items = new List<string>(Items)
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
