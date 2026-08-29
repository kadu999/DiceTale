using System.Collections.Generic;
using UnityEngine;

namespace DiceTale
{
    /// <summary>
    /// 布尔参数组件：存一个 bool 值（纯参数存储，无事件通知）。
    /// 初始化时经枢纽上报（boolValue 字段），GM 页面用开关修改（set_bool 命令）。
    /// </summary>
    public class BoolValue : BackendComponent
    {
        [SerializeField, Tooltip("布尔参数值（GM 页面可修改）")]
        private bool value;

        /// <summary>组件 ID（与客户端组件类同名，GM 面板据此渲染开关）。</summary>
        public override string ComponentId => "BoolValue";

        /// <summary>组件默认显示名（GM 属性面板分区标题；Inspector 的 displayName 可覆盖）。</summary>
        public override string DefaultDisplayName => "布尔参数";

        /// <summary>当前值。</summary>
        public bool Value => value;

        /// <summary>本地设置值（客户端本地修改，不回执上报）。</summary>
        public void SetValue(bool newValue)
        {
            value = newValue;
        }

        /// <summary>组件数据上报：布尔参数值。</summary>
        public override void AppendToInfo(Server.ServerObjectInfo info)
        {
            AppendData(info, new ValueData { value = value });
        }

        [System.Serializable]
        private class ValueData
        {
            public bool value;
        }

        /// <summary>命令处理：set_bool（GM 开关修改，本组件自己解析并执行）。</summary>
        public override bool CanHandle(string commandType) => commandType == "set_bool";

        public override bool HandleCommand(Dictionary<string, object> msg)
        {
            value = Server.JsonParser.GetBool(msg, "value");
            return true;
        }
    }
}
