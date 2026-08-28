using System;
using System.Collections.Generic;

namespace DiceTale.Server
{
    /// <summary>
    /// 客户端 -> 服务器的消息类（配合 JsonUtility 序列化）。
    /// </summary>

    [Serializable]
    public class RequestJoinMessage
    {
        public string type = "request_join";
    }

    [Serializable]
    public class RegisterMapObjectsMessage
    {
        public string type = "register_map_objects";
        public string mapName;
        public List<SpawnInfo> spawnPoints = new List<SpawnInfo>();
        /// <summary>所有 BackendObject 的通用状态信息（供 GM 页面展示与切换状态）。</summary>
        public List<ServerObjectInfo> objects = new List<ServerObjectInfo>();
    }

    [Serializable]
    public class SpawnInfo
    {
        public string id;
    }

    /// <summary>
    /// 通用后台对象状态信息：对象 ID、显示名称、类型显示名、当前状态、全部可选状态名称、
    /// 归一化位置与物品列表。由 BackendRegistry 对每个 BackendObject 统一收集。
    /// </summary>
    [Serializable]
    public class ServerObjectInfo
    {
        public string id;
        public string name;
        public string kind;
        public string currentState;
        public List<string> states = new List<string>();
        /// <summary>对象所属地图名（客户端按对象实际所在的地图上报，避免跨图串图）。</summary>
        public string mapName;
        /// <summary>道具名（道具对象上报，供 GM 页面分配道具使用；非道具对象为空）。</summary>
        public string itemName;
        /// <summary>道具总数量（道具对象固定库存，供 GM 页面计算剩余）。</summary>
        public int quantity;
        /// <summary>遮罩纹理宽度（遮罩对象上报，供 GM 页面生成/编辑遮罩；非遮罩对象为 0）。</summary>
        public int maskWidth;
        /// <summary>遮罩纹理高度（遮罩对象上报，供 GM 页面生成/编辑遮罩；非遮罩对象为 0）。</summary>
        public int maskHeight;
        /// <summary>对象在地图图片上的归一化位置 [0,1]，y 向下（左上角为原点）。</summary>
        public Position position;
        /// <summary>物品列表（字符串），与后台同步。</summary>
        public List<string> items = new List<string>();
        /// <summary>能力组件清单（与客户端组件类同名：StateMachine/Backpack/ItemExchange/MaskObject），
        /// GM 页面据此渲染属性控件（状态单选组/物品编辑/道具分配/遮罩编辑）。</summary>
        public List<string> components = new List<string>();
    }

    [Serializable]
    public class RegisterPlayersMessage
    {
        public string type = "register_players";
        public List<PlayerInfo> players = new List<PlayerInfo>();
    }

    [Serializable]
    public class PlayerInfo
    {
        public string id;
        public string name;
    }

    [Serializable]
    public class ReportPlayerPositionMessage
    {
        public string type = "report_player_position";
        public string playerId;
        public Position position;
        public string mapName;
    }

    /// <summary>通用主体位置上报（report_object_position）：后台据此更新 objects 中的位置。</summary>
    [Serializable]
    public class ReportObjectPositionMessage
    {
        public string type = "report_object_position";
        public string objectId;
        public Position position;
        public string mapName;
    }

    /// <summary>请求后台下发 teleport_player 命令切换地图。</summary>
    [Serializable]
    public class RequestTeleportMessage
    {
        public string type = "request_teleport";
        public string mapName;
        public string spawnId;
    }

    /// <summary>应用层心跳：周期上报，供后台判断连接是否半开（后台据此清理死连接）。</summary>
    [Serializable]
    public class HeartbeatMessage
    {
        public string type = "heartbeat";
    }

    [Serializable]
    public class Position
    {
        public float x;
        public float y;
    }
}
