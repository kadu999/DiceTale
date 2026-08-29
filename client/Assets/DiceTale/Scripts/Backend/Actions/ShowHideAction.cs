using UnityEngine;

namespace DiceTale
{
    /// <summary>
    /// 显示/隐藏动作：继承 <see cref="BackendChangeAction"/>。
    /// 组件数据改变时（OnComponentChanged）用 <see cref="showCondition"/> 评估 source 组件的当前值：
    /// 满足条件显示/激活目标，否则隐藏/停用。条件支持任意实现 <see cref="IBackendValue"/> 的组件
    /// （BoolValue 开关、OptionValue 选项名、数值阈值…）；条件留空恒显示。
    /// 目标为空时作用于自身。把基类 BackendChangeAction 的 source 字段指向目标组件即可。
    /// </summary>
    public class ShowHideAction : BackendChangeAction
    {
        [SerializeField, Tooltip("显示条件：source 组件满足条件时显示/激活目标，否则隐藏/停用；留空恒显示")]
        private ComponentCondition showCondition;

        [SerializeField, Tooltip("要激活/隐藏的目标物体；为空时使用自身")]
        private GameObject target;

        public override void OnComponentChanged(BackendComponent component)
        {
            var go = target != null ? target : gameObject;
            if (go == null)
            {
                return;
            }

            go.SetActive(showCondition == null || showCondition.Evaluate(component));
        }
    }
}
