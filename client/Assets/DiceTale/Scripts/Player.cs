using UnityEngine;

namespace DiceTale
{
    public class Player : MonoBehaviour
    {
        /// <summary>玩家唯一标识（由 CharacterManager 分配，上报给服务器）。</summary>
        public string PlayerId { get; private set; } = "Player_1";

        public void SetPlayerId(string playerId)
        {
            if (!string.IsNullOrEmpty(playerId))
            {
                PlayerId = playerId;
            }
        }
    }
}
