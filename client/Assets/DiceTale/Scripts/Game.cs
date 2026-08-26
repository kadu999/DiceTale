using System.Collections;
using UnityEngine;

namespace DiceTale
{
    public enum GameState
    {
        Boot,
        MainMenu,
        PlayerSelection,
        Playing
    }

    public class Game : MonoBehaviour
    {
        public SceneManager SceneManager { get; private set; }
        public CharacterManager CharacterManager { get; private set; }
        public ProgressManager ProgressManager { get; private set; }
        public InputManager InputManager { get; private set; }
        public MapManager MapManager { get; private set; }
        public BackendManager BackendManager { get; private set; }

        public GameState State { get; private set; } = GameState.Boot;
        public bool CanInteract { get; private set; } = true;

        private void Awake()
        {
            SceneManager = GetOrCreateManager<SceneManager>();
            CharacterManager = GetOrCreateManager<CharacterManager>();
            ProgressManager = GetOrCreateManager<ProgressManager>();
            InputManager = GetOrCreateManager<InputManager>();
            MapManager = GetOrCreateManager<MapManager>();
            BackendManager = GetOrCreateManager<BackendManager>();
        }

        private void Start()
        {
            if (CharacterManager.Players.Count == 0)
            {
                CharacterManager.CreatePlayers(1);
            }
        }

        private void OnDestroy()
        {
            GameEventBus.Clear();
        }

        public void LockInteraction(float duration)
        {
            CanInteract = false;
            StopCoroutine(nameof(UnlockInteractionAfter));
            StartCoroutine(UnlockInteractionAfter(duration));
        }

        private IEnumerator UnlockInteractionAfter(float duration)
        {
            yield return new WaitForSeconds(duration);
            CanInteract = true;
        }

        private T GetOrCreateManager<T>() where T : MonoBehaviour
        {
            var manager = Object.FindFirstObjectByType<T>();
            if (manager != null)
            {
                return manager;
            }

            var go = new GameObject(typeof(T).Name);
            go.transform.SetParent(transform, false);
            return go.AddComponent<T>();
        }

        public void ChangeState(GameState newState)
        {
            State = newState;
        }
    }
}
