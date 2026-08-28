using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Events;

namespace DiceTale
{
    /// <summary>
    /// 状态机组件（组件模型下的能力组件，原 SceneObject 拆分后的状态机部分）：
    /// 提供 Inspector 状态列表、进入事件（onStateEnter）与状态动作列表（statefulActions）。
    /// 与 <see cref="BackendObject"/> 枢纽挂同一物体：
    /// - 状态列表/当前状态由枢纽聚合上报（ISceneStateMachine）；
    /// - set_object_state 命令由枢纽转发到 TrySetState，切换后经枢纽上报（ReportStateChanged）；
    /// - 显示名称在枢纽上配置（BackendObject.displayName，后台看名字识别对象）；
    /// - 物品列表已拆分到 <see cref="ItemInventory"/>（需要的物体另挂该组件）。
    /// </summary>
    [DisallowMultipleComponent]
    [RequireComponent(typeof(BackendObject))]
    public class SceneObject : MonoBehaviour, ISceneStateMachine
    {
        [SerializeField, Tooltip("状态列表（仅状态名称）；后台可用 set_object_state 按名称切换")]
        private List<SceneObjectState> states = new List<SceneObjectState>();

        [SerializeField, Tooltip("当前状态索引（对应状态列表中的位置，从 0 开始；越界时回退到第 0 个状态）")]
        private int currentState;

        [SerializeField, Tooltip("状态进入事件：进入任意状态时触发，携带进入的状态（SceneObjectState）")]
        private UnityEvent<SceneObjectState> onStateEnter;

        [SerializeField, Tooltip("状态动作列表：进入任意状态时依次调用每个动作的指定函数 OnStateEnter（可挂在任意物体上）")]
        private List<StatefulAction> statefulActions = new List<StatefulAction>();

        /// <summary>当前状态名称；未配置状态或尚未启动时为 null。</summary>
        public string CurrentStateName =>
            currentState >= 0 && currentState < states.Count ? states[currentState].Name : null;

        /// <summary>全部可选状态名称（上报给 GM 页面展示与切换）。</summary>
        public List<string> StateNames
        {
            get
            {
                var names = new List<string>(states.Count);
                foreach (var state in states)
                {
                    names.Add(state.Name);
                }

                return names;
            }
        }

        private void OnValidate()
        {
            // 编辑器里挂/改组件时同步枢纽的能力组件列表
            GetComponent<BackendObject>()?.RefreshCapabilityComponents();
        }

        private void OnEnable()
        {
            // 通知枢纽刷新能力组件列表（挂/摘组件后保持同步）
            GetComponent<BackendObject>()?.RefreshCapabilityComponents();
        }

        private void Start()
        {
            // 进入当前状态（按索引对应状态列表；越界时回退到第 0 个），触发其 Action 与状态动作
            if (states.Count > 0)
            {
                if (currentState < 0 || currentState >= states.Count)
                {
                    Debug.LogWarning($"[SceneObject] {name}: current state index {currentState} out of range, fallback to first state.");
                    currentState = 0;
                }

                EnterState(currentState);
            }
        }

        /// <summary>
        /// 按名称切换状态（后台服务器 set_object_state 命令经枢纽转发调用）。
        /// 切换到新状态时触发该状态的 Action 并同步 Current State 索引；已是同名状态时不重复触发。
        /// </summary>
        /// <returns>状态存在并切换成功（或已在同状态）返回 true；名称不存在返回 false。</returns>
        public bool TrySetState(string stateName)
        {
            if (string.IsNullOrEmpty(stateName))
            {
                return false;
            }

            for (int i = 0; i < states.Count; i++)
            {
                if (!string.Equals(states[i].Name, stateName, System.StringComparison.OrdinalIgnoreCase))
                {
                    continue;
                }

                if (currentState == i)
                {
                    return true;
                }

                EnterState(i);
                GetComponent<BackendObject>()?.ReportStateChanged();
                return true;
            }

            return false;
        }

        /// <summary>是否配置了指定名称的状态（不区分大小写）。</summary>
        public bool HasState(string stateName)
        {
            if (string.IsNullOrEmpty(stateName))
            {
                return false;
            }

            for (int i = 0; i < states.Count; i++)
            {
                if (string.Equals(states[i].Name, stateName, System.StringComparison.OrdinalIgnoreCase))
                {
                    return true;
                }
            }

            return false;
        }

        /// <summary>进入指定状态：触发 onStateEnter（携带进入的状态）与状态动作列表（所有状态进入都会触发）。</summary>
        private void EnterState(int index)
        {
            currentState = index;
            var state = states[index];
            onStateEnter?.Invoke(state);

            foreach (var action in statefulActions)
            {
                action?.OnStateEnter(state);
            }
        }
    }

    /// <summary>
    /// 场景物体的一个状态：只包含状态名称（供后台 set_object_state 按名称切换）。
    /// 进入状态的 onStateEnter 事件与状态动作（<see cref="StatefulAction"/>）
    /// 在 SceneObject 上统一配置，进入任意状态都会触发（并携带该状态）。
    /// </summary>
    [System.Serializable]
    public class SceneObjectState
    {
        [SerializeField, Tooltip("状态名称（后台服务器切换状态时使用的名称）")]
        private string name;

        public string Name => name;
    }
}
