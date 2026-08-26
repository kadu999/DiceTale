using System;
using UnityEngine;

namespace DiceTale
{
    public class MockBackendService : IBackendService
    {
        public void RequestDoorAccess(string doorId, Action<bool> callback)
        {
            Debug.Log($"[MockBackend] Door access requested: {doorId}");
            callback?.Invoke(true);
        }
    }
}
