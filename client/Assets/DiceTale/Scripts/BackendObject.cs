using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Events;

namespace DiceTale
{
    /// <summary>
    /// 后台对象的一个状态：包含状态名称与进入该状态时触发的 Action。
    /// 后台服务器通过 set_object_state 命令按名称切换对象状态。
    /// </summary>
    [System.Serializable]
    public class BackendObjectState
    {
        [SerializeField, Tooltip("状态名称（后台服务器切换状态时使用的名称）")]
        private string name;

        [SerializeField, Tooltip("进入该状态时触发的 Action")]
        private UnityEvent onEnter;

        public string Name => name;

        public UnityEvent OnEnter => onEnter;
    }

    /// <summary>
    /// 后台对象基类（可直接挂在场景物体上使用，无需继承）：
    /// 所有需要与后台（backend）通信、或受后台控制的物体
    /// （门、玩家、出生点等）都继承它。
    ///
    /// 基类自动完成：
    /// - 启用/销毁时注册/注销到 <see cref="BackendRegistry"/>；
    /// - 提供统一的对象 ID（ObjectId，可覆写）；
    /// - 提供向后台发送消息、世界坐标转图片归一化坐标的工具；
    /// - 通用状态机：在 Inspector 的状态列表里配置（名称 + 进入时触发的 Action），
    ///   Current State 为当前状态索引（对应状态列表位置，启动时进入，切换时自动同步），
    ///   后台服务器可用 set_object_state { objectId, state } 按名称切换任意对象的状态，
    ///   切换后自动回执 report_object_state，GM 页面实时同步。
    ///
    /// 注册表在连接建立时统一上报（通用状态信息由 BackendObject 自动加入 objects 列表）；
    /// 子类可按需覆写 <see cref="AppendToReport"/> 追加专用字段。
    /// 后台命令经 ServerCommandDispatcher 按 ObjectId 定位。
    /// </summary>
    public class BackendObject : MonoBehaviour
    {
        /// <summary>后台使用的唯一对象 ID（子类覆写：Door 用 doorId、Player 用 PlayerId、SpawnPoint 用 id）。</summary>
        public virtual string ObjectId => name;

        [SerializeField, Tooltip("显示名称（GM 页面展示用，标明这个物体是什么）；为空时回退到对象 ID")]
        private string displayName;

        /// <summary>GM 页面显示的名称：优先取显示名称，为空时回退对象 ID。</summary>
        public string DisplayName => !string.IsNullOrEmpty(displayName) ? displayName : ObjectId;

        /// <summary>对象类型显示名（GM 页面展示用），默认取类名。</summary>
        public virtual string ObjectKind => GetType().Name;

        [SerializeField, Tooltip("状态列表（名称 + 进入时触发的 Action）；后台可用 set_object_state 按名称切换")]
        private List<BackendObjectState> states = new List<BackendObjectState>();

        [SerializeField, Tooltip("当前状态索引（对应状态列表中的位置，从 0 开始；越界时回退到第 0 个状态）")]
        private int currentState;

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

        private readonly List<string> items = new List<string>();

        /// <summary>物品列表（只读视图；修改用 AddItem/RemoveItem/SetItems，与后台同步）。</summary>
        public IReadOnlyList<string> Items => items;

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
        public void SetItems(IEnumerable<string> newItems)
        {
            items.Clear();
            if (newItems != null)
            {
                items.AddRange(newItems);
            }

            ReportItems();
        }

        /// <summary>上报物品列表（本地增删或整体设置后触发）。</summary>
        private void ReportItems()
        {
            var connection = Server.ServerConnection.Instance;
            if (connection == null || !connection.IsConnected)
            {
                return;
            }

            SendToBackend(new Server.ReportObjectItemsMessage
            {
                objectId = ObjectId,
                items = new List<string>(items)
            });
        }

        protected virtual void OnEnable()
        {
            BackendRegistry.Instance.Register(this);
        }

        protected virtual void OnDisable()
        {
            var registry = BackendRegistry.Instance;
            if (registry != null)
            {
                registry.Unregister(this);
            }
        }

        protected virtual void Start()
        {
            // 进入当前状态（按索引对应状态列表；越界时回退到第 0 个），触发其 Action
            if (states.Count > 0)
            {
                if (currentState < 0 || currentState >= states.Count)
                {
                    Debug.LogWarning($"[BackendObject] {ObjectId}: current state index {currentState} out of range, fallback to first state.");
                    currentState = 0;
                }

                states[currentState].OnEnter?.Invoke();
            }
        }

        /// <summary>
        /// 按名称切换状态（后台服务器 set_object_state 命令调用）。
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

        /// <summary>
        /// 把自身信息追加到上报消息（默认空实现：通用状态信息已由注册表统一加入 objects）。
        /// 子类可按需覆写追加专用字段，如门/出生点加入地图对象消息、玩家加入玩家名单消息。
        /// </summary>
        public virtual void AppendToReport(
            Server.RegisterMapObjectsMessage mapObjects,
            Server.RegisterPlayersMessage players)
        {
        }

        /// <summary>状态切换后上报给后台，使 GM 页面同步显示当前状态。</summary>
        private void ReportStateChanged()
        {
            var stateName = CurrentStateName;
            if (string.IsNullOrEmpty(stateName))
            {
                return;
            }

            SendToBackend(new Server.ReportObjectStateMessage
            {
                objectId = ObjectId,
                state = stateName
            });
        }

        /// <summary>向后台发送一条消息（JSON 自动序列化）。</summary>
        protected void SendToBackend(object message)
        {
            var connection = Server.ServerConnection.Instance;
            if (connection != null && connection.IsConnected)
            {
                connection.Send(message);
            }
        }

        /// <summary>对象自身位置的归一化坐标（上报给 GM 页面在地图上定位目标）。</summary>
        public Server.Position GetNormalizedPosition()
        {
            return NormalizePosition(transform.position);
        }

        /// <summary>把世界坐标换算为当前地图图片的归一化坐标（y 向下，左上角为原点）。</summary>
        protected Server.Position NormalizePosition(Vector3 worldPosition)
        {
            var mapManager = Object.FindFirstObjectByType<MapManager>();
            if (mapManager == null)
            {
                return new Server.Position { x = 0.5f, y = 0.5f };
            }

            return mapManager.GetNormalizedPosition(worldPosition);
        }
    }
}
