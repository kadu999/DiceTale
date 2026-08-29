using UnityEngine;

namespace DiceTale
{
    /// <summary>
    /// 变更动作基类：所有「组件变更动作」的统一基类（抽象类，不可直接挂到物体上）。
    /// 不继承 <see cref="BackendObject"/>，可挂在任意物体上；子类覆写
    /// <see cref="OnComponentChanged(BackendComponent)"/> 即可在代码里响应组件数据变化。
    ///
    /// 触发方式：把 <see cref="source"/> 指向任意 <see cref="BackendComponent"/>——该组件数据改变
    /// （NotifyChanged → Changed 事件，后台命令或本地修改都会触发）时被调用，component 即触发源；
    /// 是否执行效果由子类的 <see cref="ComponentCondition"/> 决定（对任意 IBackendValue 组件通用）。
    /// </summary>
    public abstract class BackendChangeAction : MonoBehaviour
    {
        [SerializeField, Tooltip("要监听的组件：该组件数据改变（Changed 事件）时调用 OnComponentChanged；留空时不会被触发")]
        private BackendComponent source;

        private void OnEnable()
        {
            if (source != null)
            {
                source.Changed += OnComponentChanged;
            }
        }

        private void OnDisable()
        {
            if (source != null)
            {
                source.Changed -= OnComponentChanged;
            }
        }

        /// <summary>指定函数：组件数据改变时调用（component 即触发源，可强转具体组件读最新值）。</summary>
        public abstract void OnComponentChanged(BackendComponent component);
    }
}
