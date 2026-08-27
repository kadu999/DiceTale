using UnityEngine;

namespace DiceTale
{
    /// <summary>
    /// 显示/隐藏动作：继承 <see cref="StatefulAction"/>。
    /// 状态进入时（初始状态 Start 与后台 set_object_state 切换）按状态名控制目标 GameObject：
    /// 进入名称与 <see cref="activeStateName"/> 匹配的状态时显示/激活目标，进入其他状态时隐藏/停用。
    /// 目标为空时作用于自身。挂到 SceneObject 的「状态动作列表」即可，任意状态切换都会重新评估显隐。
    /// </summary>
    public class ShowHideAction : StatefulAction
    {
        [SerializeField, Tooltip("激活状态名：进入该名称的状态时显示/激活目标，进入其他状态时隐藏/停用")]
        private string activeStateName;

        [SerializeField, Tooltip("要激活/隐藏的目标物体；为空时使用自身")]
        private GameObject target;

        public override void OnStateEnter(SceneObjectState state)
        {
            var go = target != null ? target : gameObject;
            if (go == null)
            {
                return;
            }

            var active = !string.IsNullOrEmpty(activeStateName) &&
                         string.Equals(state.Name, activeStateName, System.StringComparison.OrdinalIgnoreCase);
            go.SetActive(active);
        }
    }
}
