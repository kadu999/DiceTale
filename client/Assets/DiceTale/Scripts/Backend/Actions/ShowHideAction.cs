using UnityEngine;

namespace DiceTale
{
    /// <summary>
    /// 显示/隐藏动作：继承 <see cref="BackendChangeAction"/>。
    /// 组件数据改变时（OnComponentChanged：OptionValue 选项切换，或 base 的 source 组件数据改变）
    /// 按状态名控制目标 GameObject：进入名称与 <see cref="activeStateName"/> 匹配的状态时显示/激活目标，
    /// 进入其他状态时隐藏/停用。目标为空时作用于自身。
    /// 把基类 BackendChangeAction 的 source 字段指向目标组件即可，任意选项切换都会重新评估显隐。
    /// </summary>
    public class ShowHideAction : BackendChangeAction
    {
        [SerializeField, Tooltip("激活状态名：进入该名称的状态时显示/激活目标，进入其他状态时隐藏/停用")]
        private string activeStateName;

        [SerializeField, Tooltip("要激活/隐藏的目标物体；为空时使用自身")]
        private GameObject target;

        public override void OnComponentChanged(BackendComponent component)
        {
            if (!(component is OptionValue sm))
            {
                return;
            }

            var go = target != null ? target : gameObject;
            if (go == null)
            {
                return;
            }

            var active = !string.IsNullOrEmpty(activeStateName) &&
                         string.Equals(sm.CurrentStateName, activeStateName, System.StringComparison.OrdinalIgnoreCase);
            go.SetActive(active);
        }
    }
}
