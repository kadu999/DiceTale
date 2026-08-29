using System.Collections.Generic;
using UnityEngine;

namespace DiceTale
{
    /// <summary>
    /// 后台能力接口集合（组件模型）：
    /// <see cref="IBackendComponentData"/>（数据上报）与 <see cref="IBackendCommandHandler"/>（命令处理）
    /// 由 <see cref="BackendComponent"/> 基类实现，子类覆写；
    /// <see cref="IBackendValue"/>（值查询）由各值组件（BoolValue/IntValue/FloatValue/OptionValue）实现，
    /// 供 <see cref="ComponentCondition"/> 通用条件比较。
    /// </summary>

    /// <summary>
    /// 组件数据上报能力：组件把自己的参数（数据）填充到 GM 上报信息 <see cref="Server.ServerObjectInfo"/>。
    /// 由 <see cref="BackendComponent"/> 基类实现（默认空实现），有数据要上报的子类覆写，
    /// 只填自己负责的字段（OptionValue 填选项、Backpack 填道具、ItemExchange 填货源、Mask 填遮罩）。
    /// </summary>
    public interface IBackendComponentData
    {
        /// <summary>把本组件的参数填充到上报信息（只填自己负责的字段，其余保持默认）。</summary>
        void AppendToInfo(Server.ServerObjectInfo info);
    }

    /// <summary>
    /// 命令处理能力：组件自己处理对应后台命令（解析参数并执行），枢纽只做通用路由、分派器只做定位。
    /// 由 <see cref="BackendComponent"/> 基类实现（默认不处理任何命令），子类覆写声明并执行自己的命令：
    /// <see cref="OptionValue"/>（set_object_state）、<see cref="Backpack"/>（set_object_items）、
    /// <see cref="Mask"/>（set_mask_image / erase_mask）。
    /// </summary>
    public interface IBackendCommandHandler
    {
        /// <summary>是否处理该命令类型（后台消息 type，如 "set_object_state"）。</summary>
        bool CanHandle(string commandType);

        /// <summary>执行命令（msg 为后台消息字典，组件自己解析参数）；返回是否成功处理。</summary>
        bool HandleCommand(Dictionary<string, object> msg);
    }

    /// <summary>值形态：<see cref="ComponentCondition"/> 按形态选择比较分支。</summary>
    public enum BackendValueKind
    {
        Bool,
        String,
        Number
    }

    /// <summary>
    /// 值组件能力：可被 <see cref="ComponentCondition"/> 查询当前值（动作通用触发条件的入口）。
    /// 各值组件声明自己的值形态并实现对应 getter，条件侧不认识任何具体组件类型——
    /// 新增值组件只需实现本接口，条件与动作零改动。
    /// </summary>
    public interface IBackendValue
    {
        /// <summary>值的形态（决定用哪个 getter 比较）。</summary>
        BackendValueKind ValueKind { get; }

        /// <summary>Bool 形态的值（BoolValue）；其他形态返回默认值。</summary>
        bool BoolValue { get; }

        /// <summary>String 形态的值（OptionValue → 当前选项名）；其他形态返回 null。</summary>
        string StringValue { get; }

        /// <summary>Number 形态的值（IntValue/FloatValue）；其他形态返回 0。</summary>
        float NumberValue { get; }
    }
}
