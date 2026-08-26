using System.Collections.Generic;
using DiceTale.Server;
using NUnit.Framework;
using UnityEngine;

namespace DiceTale.Editor.Tests
{
    public class ServerConnectionTests
    {
        [Test]
        public void RegisterMapObjectsMessage_SerializesSpawnsAndObjects()
        {
            var msg = new RegisterMapObjectsMessage { mapName = "Map001" };
            msg.spawnPoints.Add(new SpawnInfo { id = "Default" });
            msg.objects.Add(new ServerObjectInfo
            {
                id = "Lever_1",
                name = "大厅拉杆",
                kind = "Lever",
                currentState = "off",
                states = new List<string> { "off", "on" },
                position = new Position { x = 0.4f, y = 0.3f }
            });

            var json = JsonUtility.ToJson(msg);
            Assert.IsTrue(json.Contains("\"type\":\"register_map_objects\""));
            Assert.IsTrue(json.Contains("\"mapName\":\"Map001\""));
            Assert.IsTrue(json.Contains("\"Default\""));
            Assert.IsTrue(json.Contains("\"Lever_1\""));
            Assert.IsTrue(json.Contains("\"大厅拉杆\""));
            Assert.IsTrue(json.Contains("\"currentState\":\"off\""));
            Assert.IsTrue(json.Contains("\"position\":{\"x\":0.4"));
        }

        [Test]
        public void ReportObjectStateMessage_SerializesCorrectly()
        {
            var msg = new ReportObjectStateMessage { objectId = "Lever_1", state = "on" };
            var json = JsonUtility.ToJson(msg);
            Assert.IsTrue(json.Contains("\"type\":\"report_object_state\""));
            Assert.IsTrue(json.Contains("\"objectId\":\"Lever_1\""));
            Assert.IsTrue(json.Contains("\"state\":\"on\""));
        }

        [Test]
        public void RequestTeleportMessage_SerializesCorrectly()
        {
            var msg = new RequestTeleportMessage { mapName = "Map002", spawnId = "North" };
            var json = JsonUtility.ToJson(msg);
            Assert.IsTrue(json.Contains("\"type\":\"request_teleport\""));
            Assert.IsTrue(json.Contains("\"mapName\":\"Map002\""));
            Assert.IsTrue(json.Contains("\"spawnId\":\"North\""));
        }

        [Test]
        public void ServerObjectInfo_SerializesItems()
        {
            var msg = new RegisterMapObjectsMessage { mapName = "Map001" };
            msg.objects.Add(new ServerObjectInfo
            {
                id = "Player_1",
                name = "小明",
                kind = "Player",
                items = new List<string> { "小刀", "草药" }
            });

            var json = JsonUtility.ToJson(msg);
            Assert.IsTrue(json.Contains("\"type\":\"register_map_objects\""));
            Assert.IsTrue(json.Contains("\"items\":[\"小刀\",\"草药\"]"));
        }

        [Test]
        public void ReportObjectItemsMessage_SerializesCorrectly()
        {
            var msg = new ReportObjectItemsMessage
            {
                objectId = "Lever_1",
                items = new List<string> { "钥匙" }
            };

            var json = JsonUtility.ToJson(msg);
            Assert.IsTrue(json.Contains("\"type\":\"report_object_items\""));
            Assert.IsTrue(json.Contains("\"objectId\":\"Lever_1\""));
            Assert.IsTrue(json.Contains("\"items\":[\"钥匙\"]"));
        }

        [Test]
        public void JsonParser_ParsesSyncStateWithObjectDictionary()
        {
            const string json = "{\"type\":\"sync_state\",\"state\":{\"currentMap\":\"Map001\"," +
                                "\"player\":{\"position\":{\"x\":1.5,\"y\":2.5}}," +
                                "\"objects\":{\"Lever_1\":{\"kind\":\"Lever\",\"currentState\":\"off\"," +
                                "\"states\":[\"off\",\"on\"]}}," +
                                "\"spawnPoints\":{\"Map001\":[{\"id\":\"Default\"}]}}}";

            var msg = JsonParser.ParseObject(json);
            Assert.AreEqual("sync_state", JsonParser.GetString(msg, "type"));

            var state = JsonParser.GetObject(msg, "state");
            Assert.AreEqual("Map001", JsonParser.GetString(state, "currentMap"));

            var objects = JsonParser.GetObject(state, "objects");
            Assert.IsNotNull(objects);
            Assert.IsTrue(objects.ContainsKey("Lever_1"));
            var objState = objects["Lever_1"] as Dictionary<string, object>;
            Assert.IsNotNull(objState);
            Assert.AreEqual("Lever", JsonParser.GetString(objState, "kind"));
            Assert.AreEqual("off", JsonParser.GetString(objState, "currentState"));

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
