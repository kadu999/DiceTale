using UnityEngine;

namespace DiceTale
{
    public class PlayerSpawn : MonoBehaviour
    {
        [SerializeField]
        private string spawnId = "Default";

        public string SpawnId => spawnId;
        public Vector3 Position => transform.position;
    }
}
