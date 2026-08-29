using System.Collections.Generic;
using UnityEngine;

namespace DiceTale
{
    /// <summary>
    /// 浮点参数组件：存一个 float 值（纯参数存储，无事件通知）。
    /// 初始化时经枢纽上报（floatValue 字段），GM 页面用数字输入框修改（set_float 命令）。
    /// </summary>
    public class FloatValue : BackendComponent
    {
        [SerializeField, Tooltip("浮点参数值（GM 页面可修改）")]
        private float value;

        /// <summary>组件 ID（与客户端组件类同名，GM 面板据此渲染数字输入框）。</summary>
        public override string ComponentId => "FloatValue";

        /// <summary>当前值。</summary>
        public float Value => value;

        /// <summary>本地设置值（客户端本地修改，不回执上报）。</summary>
        public void SetValue(float newValue)
        {
            value = newValue;
        }

        /// <summary>组件数据上报：浮点参数值。</summary>
        public override void AppendToInfo(Server.ServerObjectInfo info)
        {
            AppendData(info, new ValueData { value = value });
        }

        [System.Serializable]
        private class ValueData
        {
            public float value;
        }

        /// <summary>命令处理：set_float（GM 数字输入框修改，本组件自己解析并执行）。</summary>
        public override bool CanHandle(string commandType) => commandType == "set_float";

        public override bool HandleCommand(Dictionary<string, object> msg)
        {
            value = (float)Server.JsonParser.GetNumber(msg, "value");
            return true;
        }
    }
}
