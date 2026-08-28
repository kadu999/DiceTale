using System.Collections.Generic;
using UnityEngine;

namespace DiceTale
{
    /// <summary>
    /// 后台对象基类：只负责与后台（backend）的通信，不包含具体玩法逻辑。
    ///
    /// 基类自动完成：
    /// - 启用/销毁时注册/注销到 <see cref="BackendRegistry"/>；
    /// - 提供统一的对象 ID（ObjectId，可覆写）与类型显示名（ObjectKind）；
    /// - 提供向后台发送消息、世界坐标转图片归一化坐标的工具；
    /// - 提供状态/物品的同步上报入口（ReportStateChanged / ReportItems，读取虚属性）；
    /// - 提供后台命令入口（TrySetState / SetItems，默认空实现，由子类覆写具体行为）。
    ///
    /// 玩法相关的通用能力（显示名称、状态机、物品列表）放在 <see cref="SceneObject"/>，
    /// 具体对象（如 <see cref="Player"/>、<see cref="SpawnPoint"/>）按需继承。
    /// 后台命令经 ServerCommandDispatcher 按 ObjectId 定位。
    /// </summary>
    public abstract class BackendObject : MonoBehaviour
    {
        private static readonly List<string> EmptyStates = new List<string>();
        private static readonly List<string> EmptyItems = new List<string>();

        /// <summary>后台使用的唯一对象 ID（子类覆写：Player 用 PlayerId、SpawnPoint 用 id）。</summary>
        public virtual string ObjectId => name;

        /// <summary>对象类型显示名（GM 页面展示用），默认取类名。</summary>
        public virtual string ObjectKind => GetType().Name;

        /// <summary>GM 页面显示的名称：子类可覆写（如 <see cref="SceneObject"/> 用显示名称字段）。</summary>
        public virtual string DisplayName => ObjectId;

        /// <summary>当前状态名称（无状态机时为 null）；子类覆写。</summary>
        public virtual string CurrentStateName => null;

        /// <summary>全部可选状态名称（上报给 GM 页面展示与切换）；子类覆写。</summary>
        public virtual List<string> StateNames => EmptyStates;

        /// <summary>物品列表（只读视图）；子类覆写。</summary>
        public virtual IReadOnlyList<string> Items => EmptyItems;

        /// <summary>道具名（道具类对象覆写，GM 页面据此展示分配界面）；非道具对象返回 null。</summary>
        public virtual string ItemName => null;

        /// <summary>道具总数量（道具类对象覆写，固定库存；非道具对象返回 0）。</summary>
        public virtual int ItemQuantity => 0;

        /// <summary>遮罩纹理宽度（遮罩对象覆写，GM 页面据此生成/编辑遮罩；非遮罩对象返回 0）。</summary>
        public virtual int MaskWidth => 0;

        /// <summary>遮罩纹理高度（遮罩对象覆写，GM 页面据此生成/编辑遮罩；非遮罩对象返回 0）。</summary>
        public virtual int MaskHeight => 0;

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

        /// <summary>
        /// 把自身信息追加到上报消息（默认空实现：通用状态信息已由注册表统一加入 objects）。
        /// 子类可按需覆写追加专用字段，如出生点加入地图对象消息、玩家加入玩家名单消息。
        /// </summary>
        public virtual void AppendToReport(
            Server.RegisterMapObjectsMessage mapObjects,
            Server.RegisterPlayersMessage players)
        {
        }

        /// <summary>后台命令入口：按名称切换状态（默认不支持；<see cref="SceneObject"/> 实现状态机）。</summary>
        /// <returns>状态存在并切换成功（或已在同状态）返回 true；名称不存在返回 false。</returns>
        public virtual bool TrySetState(string stateName)
        {
            return false;
        }

        /// <summary>后台命令入口：整体设置物品列表（默认不支持；<see cref="SceneObject"/> 实现物品列表）。</summary>
        public virtual void SetItems(IEnumerable<string> newItems)
        {
        }

        /// <summary>后台命令入口：应用遮罩图像（base64 PNG；默认不支持，<see cref="MaskObject"/> 实现）。</summary>
        public virtual void ApplyMaskImage(string base64Png)
        {
        }

        /// <summary>状态切换后上报给后台，使 GM 页面同步显示当前状态（子类切换状态后调用）。</summary>
        protected void ReportStateChanged()
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

        /// <summary>物品列表变化后上报给后台（子类在增删物品后调用）。</summary>
        protected void ReportItems()
        {
            SendToBackend(new Server.ReportObjectItemsMessage
            {
                objectId = ObjectId,
                items = new List<string>(Items)
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
