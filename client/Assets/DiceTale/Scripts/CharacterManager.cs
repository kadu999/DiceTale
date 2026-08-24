using System;
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
                return instance;
            }
        }

        private void Awake()
        {
            instance = this;
        }
    }
}