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
        public CharacterManager CharacterManager { get; private set; }
        public InputManager InputManager { get; private set; }
        public MapManager MapManager { get; private set; }
        public BackendManager BackendManager { get; private set; }

        public GameState State { get; private set; } = GameState.Boot;
        public bool CanInteract { get; private set; } = true;

        private void Awake()
        {
            CharacterManager = GetOrCreateManager<CharacterManager>();
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

            // 等一帧，确保 MapManager.Start（LoadMap 创建地图与出生点）已执行，
            // 再统一把玩家定位到出生点（避免 Start 执行顺序导致出生点定位失效）
            StartCoroutine(PositionPlayersNextFrame());
        }

        private System.Collections.IEnumerator PositionPlayersNextFrame()
        {
            yield return null;

            if (MapManager != null)
            {
                MapManager.MovePlayersToSpawn(null);
            }
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
