using System.Collections.Generic;
using UnityEngine;

namespace DiceTale
{
    /// <summary>
    /// 后台能力接口集合（组件模型）：
    /// 具体能力由挂在 BackendObject 枢纽同物体上的「能力组件」实现这些接口，
    /// 枢纽在注册/上报/命令分发时按接口聚合与转发，从而支持任意能力组合
    /// （状态机 + 物品 + 道具货源 + 遮罩 + 角色名单）。
    /// </summary>

    /// <summary>
    /// 角色能力：提供对象 ID 覆盖与专用上报追加（玩家名单、出生点名单）。
    /// 实现者：<see cref="Player"/>、<see cref="SpawnPoint"/>。
    /// </summary>
    public interface IBackendRole
    {
        /// <summary>后台使用的对象 ID（覆盖枢纽的默认 ID，如 Player 用 PlayerId、SpawnPoint 用 id）。</summary>
        string ObjectId { get; }

        /// <summary>把自身信息追加到上报消息（玩家加入玩家名单消息、出生点加入地图对象消息）。</summary>
        void AppendToReport(
            Server.RegisterMapObjectsMessage mapObjects,
            Server.RegisterPlayersMessage players);
    }

    /// <summary>
    /// 动态显示名称能力：提供 GM 页面展示的名称；返回 null/空串时由枢纽继续回退。
    /// 静态显示名已收口到枢纽（BackendObject.displayName），本接口仅用于需要动态生成显示名的对象。
    /// 实现者：<see cref="ItemObject"/>（道具名 ×剩余）。
    /// </summary>
    public interface IBackendDisplayName
    {
        /// <summary>GM 页面显示的名称（可为 null/空串，枢纽会继续回退到对象 ID）。</summary>
        string DisplayName { get; }
    }

    /// <summary>
    /// 状态机能力：提供状态列表、当前状态与按名称切换状态（后台 set_object_state 命令）。
    /// 实现者：<see cref="SceneObject"/>。
    /// </summary>
    public interface ISceneStateMachine
    {
        /// <summary>当前状态名称（未配置状态或尚未启动时为 null）。</summary>
        string CurrentStateName { get; }

        /// <summary>全部可选状态名称（上报给 GM 页面展示与切换）。</summary>
        List<string> StateNames { get; }

        /// <summary>按名称切换状态；状态存在并切换成功（或已在同状态）返回 true，名称不存在返回 false。</summary>
        bool TrySetState(string stateName);
    }

    /// <summary>
    /// 物品能力：持有物品列表并与后台同步（后台 set_object_items 命令）。
    /// 实现者：<see cref="ItemInventory"/>。
    /// </summary>
    public interface IItemInventory
    {
        /// <summary>物品列表（只读视图）。</summary>
        IReadOnlyList<string> Items { get; }

        /// <summary>整体设置物品列表（后台命令使用，与后台同步）。</summary>
        void SetItems(IEnumerable<string> newItems);
    }

    /// <summary>
    /// 道具货源能力：提供道具名与固定总数（GM 页面据此展示分配界面与推导剩余）。
    /// 实现者：<see cref="ItemObject"/>。
    /// </summary>
    public interface IItemStock
    {
        /// <summary>道具名（不含数量，供 GM 页面分配道具使用；非道具对象返回 null）。</summary>
        string ItemName { get; }

        /// <summary>道具总数量（固定库存，GM 页面据此计算剩余）。</summary>
        int ItemQuantity { get; }
    }

    /// <summary>
    /// 遮罩能力：提供遮罩尺寸/纹理与后台遮罩命令入口（set_mask_image / erase_mask）。
    /// 实现者：<see cref="MaskObject"/>。
    /// </summary>
    public interface IMaskSource
    {
        /// <summary>遮罩纹理宽度（GM 页面据此生成/编辑遮罩；非遮罩对象为 0）。</summary>
        int MaskWidth { get; }

        /// <summary>遮罩纹理高度（GM 页面据此生成/编辑遮罩；非遮罩对象为 0）。</summary>
        int MaskHeight { get; }

        /// <summary>稳定输出遮罩纹理（Texture2D，初始全黑；外部持有引用始终有效）。</summary>
        Texture2D MaskTexture { get; }

        /// <summary>后台命令入口：应用遮罩图像（base64 PNG）。</summary>
        void ApplyMaskImage(string base64Png);

        /// <summary>后台命令入口：应用 GM 擦除的笔画轨迹（归一化点 + 归一化半径 + 软边比例）。</summary>
        void ApplyEraseStroke(Vector2[] points, float radius, float softness);
    }
}
