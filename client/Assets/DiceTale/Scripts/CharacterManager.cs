using UnityEngine;

namespace DiceTale
{
    public class CharacterManager : MonoBehaviour
    {
        public Player Player { get; private set; }

        public Player CreatePlayer()
        {
            if (Player != null)
            {
                return Player;
            }

            var playerGo = new GameObject(nameof(Player));
            var player = playerGo.AddComponent<Player>();
            Player = player;
            return player;
        }

        public void SetPlayer(Player player)
        {
            Player = player;
        }
    }
}
