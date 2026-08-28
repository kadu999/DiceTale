using UnityEngine;

namespace DiceTale
{
    /// <summary>
    /// 出生点角色组件（组件模型下的能力组件，原 SpawnPoint 的角色部分）：
    /// 提供出生点 ID、位置与出生点名单上报（IBackendRole）。
    /// 与 <see cref="BackendObject"/> 枢纽挂同一物体，对象 ID 使用自己的 id。
    /// </summary>
    [DisallowMultipleComponent]
    [RequireComponent(typeof(BackendObject))]
    public class SpawnPoint : MonoBehaviour, IBackendRole
    {
        [SerializeField]
        private string id = "Default";

        public string Id => id;
        public Vector3 Position => transform.position;

        /// <summary>后台对象 ID：出生点使用自己的 id（IBackendRole）。</summary>
        public string ObjectId => id;

        public void SetId(string id)
        {
            this.id = id;
        }

        public void AppendToReport(Server.RegisterMapObjectsMessage mapObjects, Server.RegisterPlayersMessage players)
        {
            mapObjects.spawnPoints.Add(new Server.SpawnInfo { id = Id });
        }
    }
}
