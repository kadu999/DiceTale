using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Events;

namespace DiceTale
{
    /// <summary>
    /// 状态组件（状态机）：提供 Inspector 状态列表、进入事件（onStateEnter）与状态动作列表（statefulActions）。
    /// 继承 <see cref="BackendComponent"/>，与 <see cref="BackendObject"/> 枢纽挂同一物体：
    /// - 状态列表/当前状态由组件自己上报（IBackendComponentData → GM 状态单选组）；
    /// - set_object_state 命令由枢纽路由到本组件（TrySetState），执行后不回执上报（数据由后台维护）；
    /// - 显示名称在枢纽上配置（BackendObject.displayName，后台看名字识别对象）；
    /// - 背包（道具存储）已拆分到 <see cref="Backpack"/>（需要的物体另挂该组件）。
    /// </summary>
    public class StateMachine : BackendComponent, IStateMachine
    {
        /// <summary>组件 ID（与客户端组件类同名，GM 面板据此渲染状态单选组）。</summary>
        public override string ComponentId => "StateMachine";

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

        /// <summary>组件数据上报：状态列表与当前状态（GM 属性面板的状态单选组）。</summary>
        public override void AppendToInfo(Server.ServerObjectInfo info)
        {
            info.currentState = CurrentStateName;
            info.states = StateNames;
        }

        /// <summary>命令处理：set_object_state（状态切换由本组件自己解析并执行，不再经枢纽转发）。</summary>
        public override bool CanHandle(string commandType) => commandType == "set_object_state";

        public override bool HandleCommand(Dictionary<string, object> msg)
        {
            var stateName = Server.JsonParser.GetString(msg, "state");
            return TrySetState(stateName);
        }

        private void Start()
        {
            // 进入当前状态（按索引对应状态列表；越界时回退到第 0 个），触发其 Action 与状态动作
            if (states.Count > 0)
            {
                if (currentState < 0 || currentState >= states.Count)
                {
                    Debug.LogWarning($"[StateMachine] {name}: current state index {currentState} out of range, fallback to first state.");
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

                EnterState(i); // 只执行后台命令，不回执上报（数据由后台维护）
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
    /// 在 StateMachine 上统一配置，进入任意状态都会触发（并携带该状态）。
    /// </summary>
    [System.Serializable]
    public class SceneObjectState
    {
        [SerializeField, Tooltip("状态名称（后台服务器切换状态时使用的名称）")]
        private string name;

        public string Name => name;
    }
}
