using UnityEngine;

namespace DiceTale
{
    public class Main : MonoBehaviour
    {
        // Start is called once before the first execution of Update after the MonoBehaviour is created
        void Start()
        {
            gameObject.AddComponent<SceneManager>();
            gameObject.AddComponent<CharacterManager>();
        }
    }
}


