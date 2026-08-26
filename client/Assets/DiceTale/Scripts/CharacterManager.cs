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
