using UnityEngine;

namespace DiceTale
{
    /// <summary>
    /// 显示/隐藏动作：继承 <see cref="ConditionalBackendChangeAction"/>。
    /// 组件数据改变时（OnComponentChanged）用基类条件评估所属组件的当前值：
    /// 条件满足显示/激活目标，否则隐藏/停用。条件支持任意覆写 Satisfies 的值组件
    /// （BoolValue 开关、OptionValue 选项名、数值阈值…）；条件留空恒显示。
    /// 目标为空时作用于自身。挂到组件的「变更动作列表」（actions）即可。
    /// </summary>
    public class ShowHideAction : ConditionalBackendChangeAction
    {
        [SerializeField, Tooltip("要激活/隐藏的目标物体；为空时使用自身")]
        private GameObject target;

        public override void OnComponentChanged(BackendComponent component)
        {
            var go = target != null ? target : gameObject;
            if (go == null)
            {
                return;
            }

            go.SetActive(ConditionMet(component));
        }
    }
}
