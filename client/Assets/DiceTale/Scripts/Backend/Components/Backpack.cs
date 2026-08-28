using System.Collections.Generic;
using UnityEngine;

namespace DiceTale
{
    /// <summary>
    /// 背包组件：存储道具（道具名列表，同名重复表示数量）。
    /// 供玩家等持有道具的物体使用（容器也可挂）。
    /// 继承 <see cref="BackendComponent"/>，与 <see cref="BackendObject"/> 枢纽挂同一物体：
    /// 初始化时由枢纽统一上报（IBackendComponentData），之后道具数据由后台 set_object_items 命令修改，前端不回执。
    /// </summary>
    public class Backpack : BackendComponent
    {
        /// <summary>组件 ID（与客户端组件类同名，GM 面板据此渲染物品编辑区）。</summary>
        public override string ComponentId => "Backpack";

        private readonly List<string> items = new List<string>();

        /// <summary>道具列表（只读视图；由后台命令修改）。</summary>
        public IReadOnlyList<string> Items => items;

        /// <summary>组件数据上报（初始化）：道具列表（GM 属性面板的物品编辑区）。</summary>
        public override void AppendToInfo(Server.ServerObjectInfo info)
        {
            info.items = new List<string>(items);
        }

        /// <summary>命令处理：set_object_items（道具列表由本组件自己解析并执行）。</summary>
        public override bool CanHandle(string commandType) => commandType == "set_object_items";

        public override bool HandleCommand(Dictionary<string, object> msg)
        {
            var rawItems = Server.JsonParser.GetArray(msg, "items");
            var newItems = new List<string>();
            if (rawItems != null)
            {
                foreach (var raw in rawItems)
                {
                    if (raw is string s)
                    {
                        newItems.Add(s);
                    }
                }
            }

            SetItems(newItems);
            return true;
        }

        /// <summary>添加道具（重复添加忽略；本地修改，不回执）。</summary>
        public void AddItem(string item)
        {
            if (string.IsNullOrEmpty(item) || items.Contains(item))
            {
                return;
            }

            items.Add(item);
        }

        /// <summary>移除道具（不存在时无操作；本地修改，不回执）。</summary>
        public void RemoveItem(string item)
        {
            items.Remove(item);
        }

        /// <summary>整体设置道具列表（后台 set_object_items 命令经枢纽路由调用；本地修改，不回执）。</summary>
        public void SetItems(IEnumerable<string> newItems)
        {
            items.Clear();
            if (newItems != null)
            {
                items.AddRange(newItems);
            }
        }
    }
}
