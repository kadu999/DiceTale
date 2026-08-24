using System;
using System.Collections;
using UnityEngine;
using UnitySceneManager = UnityEngine.SceneManagement.SceneManager;

namespace DiceTale
{
    public class SceneManager : MonoBehaviour
    {
        public string CurrentSceneName { get; private set; }
        public bool IsLoading { get; private set; }
        public float Progress { get; private set; }

        public event Action<string> OnSceneLoadStarted;
        public event Action<float> OnSceneLoadProgressChanged;
        public event Action<string> OnSceneLoadCompleted;

        private void Awake()
        {
            CurrentSceneName = UnitySceneManager.GetActiveScene().name;
        }

        public void LoadScene(string sceneName)
        {
            if (string.IsNullOrEmpty(sceneName))
            {
                throw new ArgumentException("Scene name cannot be null or empty.", nameof(sceneName));
            }

            if (IsLoading)
            {
                return;
            }

            StartCoroutine(LoadSceneCoroutine(sceneName));
        }

        private IEnumerator LoadSceneCoroutine(string sceneName)
        {
            IsLoading = true;
            Progress = 0f;
            OnSceneLoadStarted?.Invoke(sceneName);

            var operation = UnitySceneManager.LoadSceneAsync(sceneName, UnityEngine.SceneManagement.LoadSceneMode.Single);
            if (operation == null)
            {
                IsLoading = false;
                OnSceneLoadProgressChanged?.Invoke(0f);
                yield break;
            }

            while (!operation.isDone)
            {
                Progress = Mathf.Clamp01(operation.progress / 0.9f);
                OnSceneLoadProgressChanged?.Invoke(Progress);
                yield return null;
            }

            Progress = 1f;
            OnSceneLoadProgressChanged?.Invoke(1f);
            CurrentSceneName = sceneName;
            IsLoading = false;

            OnSceneLoadCompleted?.Invoke(sceneName);
        }
    }
}
