using System.Collections.Generic;
using UnityEngine;

namespace DiceTale
{
    /// <summary>
    /// 后台能力接口集合（组件模型）：
    /// - <see cref="IBackendDisplayName"/>：动态显示名（枢纽直接查询）；
    /// - <see cref="IBackendComponentData"/> / <see cref="IBackendCommandHandler"/>：数据上报与命令处理，
    ///   由 <see cref="BackendComponent"/> 基类实现，子类覆写。
    /// </summary>

    /// <summary>
    /// 动态显示名称能力：提供 GM 页面展示的名称；返回 null/空串时由枢纽继续回退。
    /// 静态显示名已收口到枢纽（BackendObject.displayName），本接口仅用于需要动态生成显示名的对象。
    /// 实现者：<see cref="ItemExchange"/>（道具名 ×剩余）。
    /// </summary>
    public interface IBackendDisplayName
    {
        /// <summary>GM 页面显示的名称（可为 null/空串，枢纽会继续回退到对象 ID）。</summary>
        string DisplayName { get; }
    }

    /// <summary>
    /// 组件数据上报能力：组件把自己的参数（数据）填充到 GM 上报信息 <see cref="Server.ServerObjectInfo"/>。
    /// 由 <see cref="BackendComponent"/> 基类实现（默认空实现），有数据要上报的子类覆写，
    /// 只填自己负责的字段（StateMachine 填状态、Backpack 填道具、ItemExchange 填货源、MaskObject 填遮罩）。
    /// </summary>
    public interface IBackendComponentData
    {
        /// <summary>把本组件的参数填充到上报信息（只填自己负责的字段，其余保持默认）。</summary>
        void AppendToInfo(Server.ServerObjectInfo info);
    }

    /// <summary>
    /// 命令处理能力：组件自己处理对应后台命令（解析参数并执行），枢纽只做通用路由、分派器只做定位。
    /// 由 <see cref="BackendComponent"/> 基类实现（默认不处理任何命令），子类覆写声明并执行自己的命令：
    /// <see cref="StateMachine"/>（set_object_state）、<see cref="Backpack"/>（set_object_items）、
    /// <see cref="MaskObject"/>（set_mask_image / erase_mask）。
    /// </summary>
    public interface IBackendCommandHandler
    {
        /// <summary>是否处理该命令类型（后台消息 type，如 "set_object_state"）。</summary>
        bool CanHandle(string commandType);

        /// <summary>执行命令（msg 为后台消息字典，组件自己解析参数）；返回是否成功处理。</summary>
        bool HandleCommand(Dictionary<string, object> msg);
    }
}
