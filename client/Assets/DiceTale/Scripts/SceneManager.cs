using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;


namespace DiceTale
{
    public class SceneManager : MonoBehaviour
    {
        private static SceneManager instance;

        public static SceneManager Instance
        {
            get
            {
                return instance;
            }
        }

        public event Action<Scene> OnSceneLoadStarted;
        public event Action<float> OnSceneLoadProgressChanged;
        public event Action<Scene> OnSceneLoadCompleted;


        private void Awake()
        {
            instance = this;
        }

        public void LoadScene(string sceneName)
        {

        }
    }
}
