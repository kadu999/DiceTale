using UnityEngine;

namespace DiceTale
{
    /// <summary>
    /// 变更动作基类：所有「组件变更动作」的统一基类（抽象类，不可直接挂到物体上）。
    /// 不继承 <see cref="BackendObject"/>，可挂在任意物体上；挂到某 <see cref="BackendComponent"/> 的
    /// 「变更动作列表」（actions）后，该组件数据改变（NotifyChanged，后台命令或本地修改都会触发）时
    /// 被调用，component 即触发它的组件；是否执行效果由条件基类 <see cref="ConditionalBackendChangeAction"/>
    /// 的 <see cref="ComponentCondition"/> 决定（对任意覆写 Satisfies 的值组件通用）。
    /// </summary>
    public abstract class BackendChangeAction : MonoBehaviour
    {
        /// <summary>指定函数：组件数据改变时调用（component 即触发它的组件，可强转具体组件读最新值）。</summary>
        public abstract void OnComponentChanged(BackendComponent component);
    }
}
