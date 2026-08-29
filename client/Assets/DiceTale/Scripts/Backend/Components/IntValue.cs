using System.Collections.Generic;
using UnityEngine;

namespace DiceTale
{
    /// <summary>
    /// 整数参数组件：存一个 int 值（纯参数存储，无事件通知）。
    /// 初始化时经枢纽上报（intValue 字段），GM 页面用整数输入框修改（set_int 命令）。
    /// </summary>
    public class IntValue : BackendComponent
    {
        [SerializeField, Tooltip("整数参数值（GM 页面可修改）")]
        private int value;

        /// <summary>组件 ID（与客户端组件类同名，GM 面板据此渲染整数输入框）。</summary>
        public override string ComponentId => "IntValue";

        /// <summary>组件默认显示名（GM 属性面板分区标题；Inspector 的 displayName 可覆盖）。</summary>
        public override string DefaultDisplayName => "整数参数";

        /// <summary>当前值。</summary>
        public int Value => value;

        /// <summary>本地设置值（客户端本地修改，不回执上报）。</summary>
        public void SetValue(int newValue)
        {
            value = newValue;
        }

        /// <summary>组件数据上报：整数参数值。</summary>
        public override void AppendToInfo(Server.ServerObjectInfo info)
        {
            AppendData(info, new ValueData { value = value });
        }

        [System.Serializable]
        private class ValueData
        {
            public int value;
        }

        /// <summary>命令处理：set_int（GM 整数输入框修改，本组件自己解析并执行）。</summary>
        public override bool CanHandle(string commandType) => commandType == "set_int";

        public override bool HandleCommand(Dictionary<string, object> msg)
        {
            value = (int)Server.JsonParser.GetNumber(msg, "value");
            return true;
        }
    }
}
