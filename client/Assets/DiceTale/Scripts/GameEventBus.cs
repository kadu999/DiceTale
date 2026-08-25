using System;
using System.Collections.Generic;

namespace DiceTale
{
    public static class GameEventBus
    {
        private static readonly Dictionary<string, Action> eventActions = new Dictionary<string, Action>();

        public static void Raise(string eventName)
        {
            if (string.IsNullOrEmpty(eventName))
            {
                return;
            }

            if (eventActions.TryGetValue(eventName, out var action))
            {
                action?.Invoke();
            }
        }

        public static void On(string eventName, Action callback)
        {
            if (string.IsNullOrEmpty(eventName) || callback == null)
            {
                return;
            }

            if (!eventActions.ContainsKey(eventName))
            {
                eventActions[eventName] = null;
            }

            eventActions[eventName] += callback;
        }

        public static void Off(string eventName, Action callback)
        {
            if (string.IsNullOrEmpty(eventName) || callback == null)
            {
                return;
            }

            if (eventActions.ContainsKey(eventName))
            {
                eventActions[eventName] -= callback;
            }
        }

        public static void Clear()
        {
            eventActions.Clear();
        }
    }
}
