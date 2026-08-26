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
    public class RequestDoorAccessMessage
    {
        public string type = "request_door_access";
        public string doorId;
    }

    [Serializable]
    public class RegisterMapObjectsMessage
    {
        public string type = "register_map_objects";
        public string mapName;
        public List<DoorInfo> doors = new List<DoorInfo>();
        public List<SpawnInfo> spawnPoints = new List<SpawnInfo>();
    }

    [Serializable]
    public class DoorInfo
    {
        public string id;
        public string targetMap;
        public string targetSpawn;
        public bool isPortal;
        /// <summary>门在地图图片上的归一化位置 [0,1]，y 向下（左上角为原点）。</summary>
        public Position position;
    }

    [Serializable]
    public class SpawnInfo
    {
        public string id;
    }

    [Serializable]
    public class ReportPlayerPositionMessage
    {
        public string type = "report_player_position";
        public Position position;
    }

    [Serializable]
    public class Position
    {
        public float x;
        public float y;
    }
}
