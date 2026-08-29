using UnityEngine;

namespace DiceTale
{
    /// <summary>
    /// 组件条件：对任意实现 <see cref="IBackendValue"/> 的组件做「当前值 vs 目标值」比较，
    /// 不依赖任何具体组件类型——BoolValue / IntValue / FloatValue / OptionValue 都可用同一套条件。
    /// 动作用它决定是否触发/显隐等效果（如 ShowHideAction.showCondition、TeleportAction.triggerCondition）。
    /// 条件在组件数据改变时（动作的 OnComponentChanged）重新评估当前值；null 条件的语义由各动作自行定义。
    /// </summary>
    [System.Serializable]
    public class ComponentCondition
    {
        /// <summary>比较操作符（按组件的值形态解释：Bool/String 只用 Equal/NotEqual；Number 支持全部）。</summary>
        public enum Op
        {
            Equal = 0,
            NotEqual = 1,
            AtLeast = 2,
            AtMost = 3
        }

        [SerializeField, Tooltip("比较操作符（按组件的值形态解释：Bool/String 只用 Equal/NotEqual；Number 支持全部）")]
        private Op op;

        [SerializeField, Tooltip("Bool 目标值（组件值形态为 Bool 时比较）")]
        private bool targetBool;

        [SerializeField, Tooltip("String 目标值（组件值形态为 String 时比较，如 OptionValue 的选项名）")]
        private string targetString;

        [SerializeField, Tooltip("Number 目标值（组件值形态为 Number 时比较）")]
        private float targetNumber;

        /// <summary>评估组件当前值是否满足条件；组件未实现 <see cref="IBackendValue"/> 时返回 false。</summary>
        public bool Evaluate(BackendComponent component)
        {
            if (!(component is IBackendValue value))
            {
                return false;
            }

            switch (value.ValueKind)
            {
                case BackendValueKind.Bool:
                    return CompareBool(value.BoolValue, targetBool);

                case BackendValueKind.String:
                    return CompareString(value.StringValue, targetString);

                case BackendValueKind.Number:
                    return CompareNumber(value.NumberValue, targetNumber);

                default:
                    return false;
            }
        }

        private bool CompareBool(bool actual, bool target)
        {
            switch (op)
            {
                case Op.Equal:
                    return actual == target;

                case Op.NotEqual:
                    return actual != target;

                default:
                    return false; // Bool 只支持等于/不等于
            }
        }

        private bool CompareString(string actual, string target)
        {
            switch (op)
            {
                case Op.Equal:
                    return string.Equals(actual, target, System.StringComparison.OrdinalIgnoreCase);

                case Op.NotEqual:
                    return !string.Equals(actual, target, System.StringComparison.OrdinalIgnoreCase);

                default:
                    return false; // String 只支持等于/不等于
            }
        }

        private bool CompareNumber(float actual, float target)
        {
            switch (op)
            {
                case Op.Equal:
                    return actual == target;

                case Op.NotEqual:
                    return actual != target;

                case Op.AtLeast:
                    return actual >= target;

                case Op.AtMost:
                    return actual <= target;

                default:
                    return false;
            }
        }
    }
}
