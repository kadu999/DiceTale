using UnityEngine;

namespace DiceTale
{
    /// <summary>出生点：继承 <see cref="BackendObject"/>（纯后台通信基类），自动上报到后台。</summary>
    public class SpawnPoint : BackendObject
    {
        [SerializeField]
        private string id = "Default";

        public string Id => id;
        public Vector3 Position => transform.position;

        /// <summary>后台对象 ID：出生点使用自己的 id。</summary>
        public override string ObjectId => id;

        public void SetId(string id)
        {
            this.id = id;
        }

        public override void AppendToReport(Server.RegisterMapObjectsMessage mapObjects, Server.RegisterPlayersMessage players)
        {
            mapObjects.spawnPoints.Add(new Server.SpawnInfo { id = Id });
        }
    }
}
