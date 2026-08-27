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

        [SerializeField, Tooltip("初始玩家数量（模拟多玩家）")]
        private int playerCount = 4;

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
                CharacterManager.CreatePlayers(playerCount);
            }

            // 玩家切换按钮 UI（Canvas 上生成，当前玩家高亮）
            gameObject.AddComponent<PlayerSwitcherUI>();

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

            // 玩家创建后统一补报一次（覆盖 Start 顺序差异：首次 ReportAll 可能早于玩家创建，
            // 否则后台/GM 页面收不到 register_players，道具分配区就没有玩家列表）
            BackendRegistry.Instance.ReportAll();
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

            // 管理器作为根节点创建：DontDestroyOnLoad 只对根节点生效（ServerConnection 依赖此行为）
            var go = new GameObject(typeof(T).Name);
            return go.AddComponent<T>();
        }

        public void ChangeState(GameState newState)
        {
            State = newState;
        }
    }
}
