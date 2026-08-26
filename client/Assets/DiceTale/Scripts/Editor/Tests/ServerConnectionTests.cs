using System.Collections.Generic;
using DiceTale.Server;
using NUnit.Framework;
using UnityEngine;

namespace DiceTale.Editor.Tests
{
    public class ServerConnectionTests
    {
        [Test]
        public void RequestDoorAccessMessage_SerializesCorrectly()
        {
            var msg = new RequestDoorAccessMessage { doorId = "Door_A1" };
            var json = JsonUtility.ToJson(msg);
            Assert.IsTrue(json.Contains("\"type\":\"request_door_access\""));
            Assert.IsTrue(json.Contains("\"doorId\":\"Door_A1\""));
        }

        [Test]
        public void RegisterMapObjectsMessage_SerializesDoorsAndSpawns()
        {
            var msg = new RegisterMapObjectsMessage { mapName = "Map001" };
            msg.doors.Add(new DoorInfo { id = "Door_A1", targetMap = "Map002", targetSpawn = "Default", isPortal = true });
            msg.spawnPoints.Add(new SpawnInfo { id = "Default" });

            var json = JsonUtility.ToJson(msg);
            Assert.IsTrue(json.Contains("\"type\":\"register_map_objects\""));
            Assert.IsTrue(json.Contains("\"mapName\":\"Map001\""));
            Assert.IsTrue(json.Contains("\"Door_A1\""));
            Assert.IsTrue(json.Contains("\"targetMap\":\"Map002\""));
        }

        [Test]
        public void JsonParser_ParsesSetDoorState()
        {
            const string json = "{\"type\":\"set_door_state\",\"doorId\":\"Door_A1\",\"unlocked\":true}";
            var msg = JsonParser.ParseObject(json);
            Assert.AreEqual("set_door_state", JsonParser.GetString(msg, "type"));
            Assert.AreEqual("Door_A1", JsonParser.GetString(msg, "doorId"));
            Assert.IsTrue(JsonParser.GetBool(msg, "unlocked"));
        }

        [Test]
        public void JsonParser_ParsesSyncStateWithDoorDictionary()
        {
            const string json = "{\"type\":\"sync_state\",\"state\":{\"currentMap\":\"Map001\"," +
                                "\"player\":{\"position\":{\"x\":1.5,\"y\":2.5}}," +
                                "\"doors\":{\"Door_A1\":{\"unlocked\":true,\"targetMap\":\"Map002\"," +
                                "\"targetSpawn\":\"Default\",\"isPortal\":true}}," +
                                "\"spawnPoints\":{\"Map001\":[{\"id\":\"Default\"}]}}}";

            var msg = JsonParser.ParseObject(json);
            Assert.AreEqual("sync_state", JsonParser.GetString(msg, "type"));

            var state = JsonParser.GetObject(msg, "state");
            Assert.AreEqual("Map001", JsonParser.GetString(state, "currentMap"));

            var doors = JsonParser.GetObject(state, "doors");
            Assert.IsNotNull(doors);
            Assert.IsTrue(doors.ContainsKey("Door_A1"));
            var doorState = doors["Door_A1"] as Dictionary<string, object>;
            Assert.IsNotNull(doorState);
            Assert.IsTrue(JsonParser.GetBool(doorState, "unlocked"));
            Assert.AreEqual("Map002", JsonParser.GetString(doorState, "targetMap"));
            Assert.IsTrue(JsonParser.GetBool(doorState, "isPortal"));

            var player = JsonParser.GetObject(state, "player");
            var position = JsonParser.GetObject(player, "position");
            Assert.AreEqual(1.5, JsonParser.GetNumber(position, "x"), 0.0001);
            Assert.AreEqual(2.5, JsonParser.GetNumber(position, "y"), 0.0001);

            var spawnPoints = JsonParser.GetObject(state, "spawnPoints");
            var mapSpawns = JsonParser.GetArray(spawnPoints, "Map001");
            Assert.IsNotNull(mapSpawns);
            Assert.AreEqual(1, mapSpawns.Count);
        }

        [Test]
        public void JsonParser_HandlesEscapedStrings()
        {
            const string json = "{\"name\":\"line\\nbreak \\\"quoted\\\"\"}";
            var msg = JsonParser.ParseObject(json);
            Assert.AreEqual("line\nbreak \"quoted\"", JsonParser.GetString(msg, "name"));
        }

        [Test]
        public void JsonParser_ReturnsNullForInvalidJson()
        {
            Assert.IsNull(JsonParser.ParseObject("not json"));
            Assert.IsNull(JsonParser.ParseObject("{ broken"));
        }
    }
}
