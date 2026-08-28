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

        private void OnValidate()
        {
            // 编辑器里挂/改组件时同步枢纽的能力组件列表
            GetComponent<BackendObject>()?.RefreshCapabilityComponents();
        }

        private void OnEnable()
        {
            // 通知枢纽刷新能力组件列表（挂/摘组件后保持同步）
            GetComponent<BackendObject>()?.RefreshCapabilityComponents();
        }

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
