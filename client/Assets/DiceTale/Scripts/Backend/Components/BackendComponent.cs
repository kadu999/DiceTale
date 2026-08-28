using UnityEngine;

namespace DiceTale
{
    /// <summary>
    /// 后台能力组件基类：所有能力组件（SceneObject 状态机 / ItemInventory 物品 / ItemObject 道具货源 /
    /// MaskObject 遮罩 / Player / SpawnPoint 角色）的统一基类。
    ///
    /// 基类提供：
    /// - <see cref="ComponentId"/>：组件 ID（与客户端组件类同名，上报给 GM 面板用于渲染控件），子类覆写；
    /// - <see cref="GmEditable"/>：GM 属性面板是否渲染该组件的编辑控件
    ///   （角色组件由玩家/出生点名单处理，不进入面板清单，覆写为 false）；
    /// - 激活时自动通知 <see cref="BackendObject"/> 枢纽刷新能力组件缓存（OnEnable 内置）；
    /// - 要求同物体必须有 BackendObject 枢纽（RequireComponent）。
    /// </summary>
    [DisallowMultipleComponent]
    [RequireComponent(typeof(BackendObject))]
    public abstract class BackendComponent : MonoBehaviour
    {
        /// <summary>组件 ID（与客户端组件类同名，如 SceneObject / ItemInventory / ItemObject / MaskObject / Player / SpawnPoint）。</summary>
        public abstract string ComponentId { get; }

        /// <summary>GM 属性面板是否渲染该组件的编辑控件（默认 true；角色组件覆写为 false）。</summary>
        public virtual bool GmEditable => true;

        protected virtual void OnEnable()
        {
            // 通知枢纽刷新能力组件缓存（激活/动态挂载后保持同步）
            GetComponent<BackendObject>()?.RefreshCapabilityComponents();
        }
    }
}
