using UnityEngine;

namespace DiceTale
{
    public abstract class Condition : MonoBehaviour
    {
        public abstract bool IsMet(Player player);
    }
}
