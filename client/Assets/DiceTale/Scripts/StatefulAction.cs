using UnityEngine;

namespace DiceTale
{
    /// <summary>
    /// 状态动作：作为 <see cref="SceneObjectState"/> 的成员变量使用（不是基类）。
    /// 不继承 <see cref="BackendObject"/>，可挂在任意物体上；
    /// 状态进入时由状态机调用其指定函数 <see cref="OnStateEnter(SceneObjectState)"/>，
    /// 覆写即可在代码里响应状态变化，而不只是依赖 Inspector 里 UnityEvent 的手动接线。
    /// </summary>
    public class StatefulAction : MonoBehaviour
    {
        /// <summary>指定函数：状态进入时调用（初始状态 Start 与后台 set_object_state 切换都会触发）。</summary>
        public virtual void OnStateEnter(SceneObjectState state)
        {
        }
    }
}
