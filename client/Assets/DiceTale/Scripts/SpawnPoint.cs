using UnityEngine;

namespace DiceTale
{
    public class SpawnPoint : MonoBehaviour
    {
        [SerializeField]
        private string id = "Default";

        public string Id => id;
        public Vector3 Position => transform.position;
    }
}
