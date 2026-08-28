using System.Collections.Generic;
using UnityEngine;

namespace DiceTale
{
    /// <summary>
    /// 玩家标记组件（过渡态）：标识这个主体是玩家。
    /// 玩家实体形态 = BackendObject（kind=Player）+ Backpack：
    /// - 身份用枢纽 ObjectId（自动唯一，无需设置玩家 ID）；
    /// - 显示名在枢纽 displayName 设置（GM 页面展示）；
    /// - 玩家登记由枢纽 AppendToReport 按 kind=Player 处理。
    /// 本组件保留仅为兼容既有 prefab 挂载；后续移除 Player 组件不影响任何功能。
    /// </summary>
    public class Player : BackendComponent
    {
        /// <summary>组件 ID（与客户端组件类同名；角色组件不进 GM 面板清单）。</summary>
        public override string ComponentId => "Player";

        /// <summary>角色组件不进 GM 属性面板清单（由玩家名单页处理）。</summary>
        public override bool GmEditable => false;

        private static readonly List<string> EmptyItems = new List<string>();

        /// <summary>GM 页面显示的名称：取枢纽显示名（未设置时回退物体名）。</summary>
        public string DisplayName => Hub != null ? Hub.DisplayName : name;

        /// <summary>道具列表（由同物体的 Backpack 提供；无背包组件时为空）。</summary>
        public IReadOnlyList<string> Items
        {
            get
            {
                var backpack = GetComponent<Backpack>();
                return backpack != null ? backpack.Items : EmptyItems;
            }
        }

        /// <summary>上报当前玩家位置（位置同步在主体枢纽，本方法只是便捷转发）。</summary>
        public void ReportPosition()
        {
            Hub?.ReportPosition();
        }
    }
}
