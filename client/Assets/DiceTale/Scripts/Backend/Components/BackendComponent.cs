using UnityEngine;

namespace DiceTale
{
    /// <summary>
    /// 后台能力组件基类：所有能力组件（StateMachine 状态机 / Backpack 背包 / ItemObject 道具货源 /
    /// MaskObject 遮罩 / Player / SpawnPoint 角色）的统一基类。
    ///
    /// 基类提供：
    /// - <see cref="ComponentId"/>：组件 ID（与客户端组件类同名，上报给 GM 面板用于渲染控件），子类覆写；
    /// - <see cref="GmEditable"/>：GM 属性面板是否渲染该组件的编辑控件
    ///   （角色组件由玩家/出生点名单处理，不进入面板清单，覆写为 false）；
    /// - 激活时自动通知 <see cref="BackendObject"/> 枢纽刷新能力组件缓存（OnEnable 内置）；
    /// - 上报触发：<see cref="ReportStateChanged"/> / <see cref="ReportItems"/> / <see cref="SendToBackend"/> /
    ///   <see cref="NormalizePosition"/>——统一转发给主体枢纽，组件不直接接触通信层；
    /// - 要求同物体必须有 BackendObject 枢纽（RequireComponent）。
    /// </summary>
    [DisallowMultipleComponent]
    [RequireComponent(typeof(BackendObject))]
    public abstract class BackendComponent : MonoBehaviour
    {
        /// <summary>组件 ID（与客户端组件类同名，如 StateMachine / Backpack / ItemObject / MaskObject / Player / SpawnPoint）。</summary>
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

        /// <summary>状态切换后上报给后台（GM 页面同步显示当前状态；状态组件切换后调用）。</summary>
        protected void ReportStateChanged()
        {
            Hub?.ReportStateChanged();
        }

        /// <summary>道具列表变化后上报给后台（GM 页面同步显示；背包组件增删道具后调用）。</summary>
        protected void ReportItems()
        {
            Hub?.ReportItems();
        }

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
