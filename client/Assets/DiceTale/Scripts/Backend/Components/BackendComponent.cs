using System.Collections.Generic;
using UnityEngine;

namespace DiceTale
{
    /// <summary>
    /// 后台能力组件基类：所有能力组件（StateMachine 状态机 / Backpack 背包 / ItemExchange 道具交换 /
    /// Mask 遮罩）的统一基类。
    ///
    /// 基类已实现组件公共契约，子类只需声明自己的能力接口：
    /// - <see cref="IBackendCommandHandler"/>：命令处理（CanHandle/HandleCommand 默认不处理，子类按需覆写）；
    /// - <see cref="IBackendComponentData"/>：数据上报（AppendToInfo 默认空实现，有数据要上报的子类覆写）。
    ///
    /// 基类另提供：
    /// - <see cref="ComponentId"/>：组件 ID（与客户端组件类同名，上报给 GM 面板用于渲染控件），子类覆写；
    /// - <see cref="GmEditable"/>：GM 属性面板是否渲染该组件的编辑控件
    ///   （角色组件由玩家/出生点名单处理，不进入面板清单，覆写为 false）；
    /// - 激活时自动通知 <see cref="BackendObject"/> 枢纽刷新能力组件缓存（OnEnable 内置）；
    /// - <see cref="SendToBackend"/> / <see cref="NormalizePosition"/>：上报触发，统一转发给主体枢纽，
    ///   组件不直接接触通信层；数据修改由后台命令驱动，前端只在初始化上报；
    /// - 同一物体可挂多个能力组件（BackendObject 枢纽 + 任意个组件组合，如 状态机+背包+数值），
    ///   多个组件各自上报数据段，GM 面板按组件类型分行渲染；
    /// - 要求同物体必须有 BackendObject 枢纽（RequireComponent）。
    /// </summary>
    [RequireComponent(typeof(BackendObject))]
    public abstract class BackendComponent : MonoBehaviour, IBackendComponentData, IBackendCommandHandler
    {
        /// <summary>组件 ID（与客户端组件类同名，如 StateMachine / Backpack / ItemExchange / Mask）。</summary>
        public abstract string ComponentId { get; }

        /// <summary>GM 属性面板是否渲染该组件的编辑控件（默认 true；角色组件覆写为 false）。</summary>
        public virtual bool GmEditable => true;

        /// <summary>主体枢纽（同物体上的 BackendObject）；组件所有上报都经它转发。</summary>
        protected BackendObject Hub => GetComponent<BackendObject>();

        protected virtual void OnEnable()
        {
            // 通知枢纽刷新能力组件缓存（激活/动态挂载后保持同步）
            Hub?.RefreshCapabilityComponents();
        }

        // ---------- IBackendComponentData（默认空实现，有数据要上报的子类覆写） ----------

        /// <summary>把本组件的参数填充到上报信息（默认空实现；各能力组件覆写）。</summary>
        public virtual void AppendToInfo(Server.ServerObjectInfo info)
        {
        }

        /// <summary>
        /// 把组件数据以 JSON 字符串追加到上报信息：component = 组件类型（ComponentId），data = JsonUtility 序列化。
        /// 谁要用谁解析（GM/后端按组件类型 JSON.parse）。覆写 AppendToInfo 时调用。
        /// </summary>
        protected void AppendData(Server.ServerObjectInfo info, object data)
        {
            info.componentData.Add(new Server.ComponentData
            {
                component = ComponentId,
                data = JsonUtility.ToJson(data)
            });
        }

        // ---------- IBackendCommandHandler（默认不处理命令，有命令要处理的子类覆写） ----------

        /// <summary>是否处理该命令类型（默认 false；StateMachine/Backpack/Mask 覆写声明自己处理的命令）。</summary>
        public virtual bool CanHandle(string commandType) => false;

        /// <summary>执行命令（默认不处理；覆写 CanHandle 的组件在此解析参数并执行）。</summary>
        public virtual bool HandleCommand(Dictionary<string, object> msg) => false;

        // ---------- 上报触发（统一经主体枢纽） ----------

        /// <summary>向后台发送一条消息（JSON 自动序列化；统一经主体枢纽）。</summary>
        protected void SendToBackend(object message)
        {
            Hub?.SendToBackend(message);
        }

        /// <summary>把世界坐标换算为当前地图图片的归一化坐标（y 向下，左上角为原点；无枢纽时回退中心点）。</summary>
        protected Server.Position NormalizePosition(Vector3 worldPosition)
        {
            var hub = Hub;
            return hub != null ? hub.NormalizePosition(worldPosition) : new Server.Position { x = 0.5f, y = 0.5f };
        }
    }
}
