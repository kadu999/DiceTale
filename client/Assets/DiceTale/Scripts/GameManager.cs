using UnityEngine;

namespace DiceTale
{
    public enum GameState
    {
        Boot,
        MainMenu,
        Playing
    }

    public class GameManager : MonoBehaviour
    {
        public SceneManager SceneManager { get; private set; }
        public CharacterManager CharacterManager { get; private set; }
        public ProgressManager ProgressManager { get; private set; }
        public InteractionManager InteractionManager { get; private set; }

        public GameState State { get; private set; } = GameState.Boot;

        private void Awake()
        {
            SceneManager = GetOrCreateManager<SceneManager>();
            CharacterManager = GetOrCreateManager<CharacterManager>();
            ProgressManager = GetOrCreateManager<ProgressManager>();
            InteractionManager = GetOrCreateManager<InteractionManager>();
        }

        private void OnDestroy()
        {
            GameEventBus.Clear();
        }

        private T GetOrCreateManager<T>() where T : MonoBehaviour
        {
            var manager = Object.FindFirstObjectByType<T>();
            if (manager != null)
            {
                return manager;
            }

            var go = new GameObject(typeof(T).Name);
            return go.AddComponent<T>();
        }

        public void ChangeState(GameState newState)
        {
            State = newState;
        }
    }
}
