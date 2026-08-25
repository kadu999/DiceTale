using UnityEngine;
using UnityEngine.Events;

namespace DiceTale
{
    public class GameEventListener : MonoBehaviour
    {
        [SerializeField]
        private string eventName;

        [SerializeField]
        private UnityEvent onEvent;

        private void OnEnable()
        {
            GameEventBus.On(eventName, OnEventRaised);
        }

        private void OnDisable()
        {
            GameEventBus.Off(eventName, OnEventRaised);
        }

        private void OnEventRaised()
        {
            onEvent?.Invoke();
        }
    }
}
