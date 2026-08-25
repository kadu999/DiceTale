using System.Collections.Generic;
using UnityEngine;

namespace DiceTale
{
    public class ProgressManager : MonoBehaviour
    {
        private readonly HashSet<string> triggeredEvents = new HashSet<string>();

        public void RaiseEvent(string eventName)
        {
            if (string.IsNullOrEmpty(eventName))
            {
                return;
            }

            if (triggeredEvents.Add(eventName))
            {
                GameEventBus.Raise(eventName);
            }
        }

        public bool HasEvent(string eventName)
        {
            return !string.IsNullOrEmpty(eventName) && triggeredEvents.Contains(eventName);
        }
    }
}
