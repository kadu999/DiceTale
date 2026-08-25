using UnityEngine;

namespace DiceTale
{
    public class Main : MonoBehaviour
    {
        private void Awake()
        {
            gameObject.AddComponent<Game>();
        }
    }
}
