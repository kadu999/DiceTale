using UnityEngine;

namespace DiceTale
{
    /// <summary>
    /// 条件变更动作基类：持有唯一的 <see cref="ComponentCondition"/>（组件条件），
    /// 所有「带条件的效果动作」（ShowHide / Teleport / TeleportZone）统一继承本类——
    /// 条件字段只有这一处引用，需要给条件加 Inspector 编辑器（CustomEditor）时
    /// 只需针对本类编写一次（[CustomEditor(typeof(ConditionalBackendChangeAction), true)]），
    /// 所有子类自动生效。
    /// 条件在所属组件数据改变（OnComponentChanged）时重新评估；condition 留空视为恒满足。
    /// </summary>
    public abstract class ConditionalBackendChangeAction : BackendChangeAction
    {
        [SerializeField, Tooltip("Trigger condition: effect runs when the owning component satisfies it; empty = always")]
        private ComponentCondition condition;

        /// <summary>条件是否满足：condition 为空视为恒满足（恒执行效果）；component 为触发来源。</summary>
        protected bool ConditionMet(BackendComponent component)
        {
            return condition == null || component.Satisfies(condition);
        }
    }
}
