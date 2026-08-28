using System.Collections.Generic;
using UnityEngine;

namespace DiceTale
{
    public class CharacterManager : MonoBehaviour
    {
        private static CharacterManager instance;

        public static CharacterManager Instance
        {
            get
            {
                if (instance == null)
                {
                    var go = new GameObject(nameof(CharacterManager));
                    instance = go.AddComponent<CharacterManager>();
                }

                return instance;
            }
        }

        public List<Player> Players { get; private set; } = new List<Player>();
        public Player CurrentPlayer { get; private set; }
        public int CurrentPlayerIndex { get; private set; }

        private void Awake()
        {
            if (instance != null && instance != this)
            {
                Destroy(gameObject);
                return;
            }

            instance = this;
        }

        /// <summary>多玩家区分色板（红/蓝/绿/黄，按序号循环取色）。</summary>
        private static readonly Color[] PlayerPalette =
        {
            new Color(0.85f, 0.3f, 0.3f, 1f),  // 红
            new Color(0.3f, 0.55f, 0.9f, 1f),  // 蓝
            new Color(0.3f, 0.8f, 0.4f, 1f),   // 绿
            new Color(0.95f, 0.8f, 0.2f, 1f),  // 黄
        };

        /// <summary>按玩家序号取区分色（与地图上玩家精灵颜色一致，超出循环取色）。</summary>
        public static Color GetPlayerColor(int index)
        {
            if (index < 0)
            {
                return Color.white;
            }

            return PlayerPalette[index % PlayerPalette.Length];
        }

        public void CreatePlayers(int count)
        {
            ClearPlayers();

            var playerPrefab = Resources.Load<GameObject>("Player");
            if (playerPrefab == null)
            {
                Debug.LogWarning("Player prefab not found in Resources");
                return;
            }

            for (int i = 0; i < count; i++)
            {
                var playerGo = Instantiate(playerPrefab);

                // 每个玩家不同颜色，便于区分（也便于 GM 页面/地图上辨认）
                var renderer = playerGo.GetComponent<SpriteRenderer>();
                if (renderer != null)
                {
                    renderer.color = PlayerPalette[i % PlayerPalette.Length];
                }

                if (playerGo.GetComponent<Collider2D>() == null)
                {
                    playerGo.AddComponent<BoxCollider2D>();
                }

                if (playerGo.GetComponent<Rigidbody2D>() == null)
                {
                    var rb = playerGo.AddComponent<Rigidbody2D>();
                    rb.gravityScale = 0f;
                    rb.bodyType = RigidbodyType2D.Kinematic;
                }

                var player = playerGo.GetComponent<Player>();
                if (player != null)
                {
                    player.SetPlayerId($"Player_{i + 1}");
                    Players.Add(player);
                }
            }

            if (Players.Count > 0)
            {
                SetCurrentPlayer(0);
            }
        }

        public void AddPlayer(Player player)
        {
            if (player == null || Players.Contains(player))
            {
                return;
            }

            Players.Add(player);
        }

        public void SetCurrentPlayer(int index)
        {
            if (index < 0 || index >= Players.Count)
            {
                return;
            }

            CurrentPlayerIndex = index;
            CurrentPlayer = Players[index];
        }

        public void NextPlayer()
        {
            if (Players.Count == 0)
            {
                return;
            }

            SetCurrentPlayer((CurrentPlayerIndex + 1) % Players.Count);
        }

        public void ClearPlayers()
        {
            foreach (var player in Players)
            {
                if (player != null)
                {
                    Destroy(player.gameObject);
                }
            }

            Players.Clear();
            CurrentPlayer = null;
            CurrentPlayerIndex = 0;
        }
    }
}
