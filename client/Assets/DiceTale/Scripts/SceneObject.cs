using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Events;

namespace DiceTale
{
    /// <summary>
    /// 通用场景物体：继承 <see cref="BackendObject"/>，在后台通信之上提供玩法通用能力：
    /// 显示名称、状态机（Inspector 状态列表，进入状态时触发 Action）与物品列表（与后台同步）。
    /// 场景中需要后台控制、又有本地行为的物体（门、机关、宝箱等）直接挂这个组件或继承它。
    /// 后台服务器用 set_object_state / set_object_items 按 ObjectId 控制。
    /// </summary>
    public class SceneObject : BackendObject
    {
        [SerializeField, Tooltip("显示名称（GM 页面展示用，标明这个物体是什么）；为空时回退到对象 ID")]
        private string displayName;

        [SerializeField, Tooltip("状态列表（名称 + 进入时触发的 Action）；后台可用 set_object_state 按名称切换")]
        private List<SceneObjectState> states = new List<SceneObjectState>();

        [SerializeField, Tooltip("当前状态索引（对应状态列表中的位置，从 0 开始；越界时回退到第 0 个状态）")]
        private int currentState;

        private readonly List<string> items = new List<string>();

        /// <summary>GM 页面显示的名称：优先取显示名称，为空时回退对象 ID。</summary>
        public override string DisplayName => !string.IsNullOrEmpty(displayName) ? displayName : ObjectId;

        /// <summary>当前状态名称；未配置状态或尚未启动时为 null。</summary>
        public override string CurrentStateName =>
            currentState >= 0 && currentState < states.Count ? states[currentState].Name : null;

        /// <summary>全部可选状态名称（上报给 GM 页面展示与切换）。</summary>
        public override List<string> StateNames
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

        /// <summary>物品列表（只读视图；修改用 AddItem/RemoveItem/SetItems，与后台同步）。</summary>
        public override IReadOnlyList<string> Items => items;

        protected virtual void Start()
        {
            // 进入当前状态（按索引对应状态列表；越界时回退到第 0 个），触发其 Action
            if (states.Count > 0)
            {
                if (currentState < 0 || currentState >= states.Count)
                {
                    Debug.LogWarning($"[SceneObject] {ObjectId}: current state index {currentState} out of range, fallback to first state.");
                    currentState = 0;
                }

                states[currentState].OnEnter?.Invoke();
            }
        }

        public void AddItem(string item)
        {
            if (string.IsNullOrEmpty(item) || items.Contains(item))
            {
                return;
            }

            items.Add(item);
            ReportItems();
        }

        public void RemoveItem(string item)
        {
            if (items.Remove(item))
            {
                ReportItems();
            }
        }

        /// <summary>整体设置物品列表（后台 set_object_items 命令使用）。</summary>
        public override void SetItems(IEnumerable<string> newItems)
        {
            items.Clear();
            if (newItems != null)
            {
                items.AddRange(newItems);
            }

            ReportItems();
        }

        /// <summary>
        /// 按名称切换状态（后台服务器 set_object_state 命令调用）。
        /// 切换到新状态时触发该状态的 Action 并同步 Current State 索引；已是同名状态时不重复触发。
        /// </summary>
        /// <returns>状态存在并切换成功（或已在同状态）返回 true；名称不存在返回 false。</returns>
        public override bool TrySetState(string stateName)
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

                currentState = i;
                states[i].OnEnter?.Invoke();
                ReportStateChanged();
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
    }

    /// <summary>
    /// 场景物体的一个状态：包含状态名称与进入该状态时触发的 Action。
    /// 后台服务器通过 set_object_state 命令按名称切换对象状态。
    /// </summary>
    [System.Serializable]
    public class SceneObjectState
    {
        [SerializeField, Tooltip("状态名称（后台服务器切换状态时使用的名称）")]
        private string name;

        [SerializeField, Tooltip("进入该状态时触发的 Action")]
        private UnityEvent onEnter;

        public string Name => name;

        public UnityEvent OnEnter => onEnter;
    }
}
