using UnityEngine;

namespace DiceTale
{
    public class BackendManager : MonoBehaviour
    {
        public static BackendManager Instance { get; private set; }

        [SerializeField]
        private bool useMock = true;

        [SerializeField]
        private string apiBaseUrl = "http://localhost:8080";

        private IBackendService service;

        private void Awake()
        {
            Instance = this;
            service = useMock
                ? (IBackendService)new MockBackendService()
                : new HttpBackendService(apiBaseUrl, this);
        }

        public void RequestDoorAccess(string doorId, System.Action<bool> callback)
        {
            if (service == null)
            {
                callback?.Invoke(true);
                return;
            }

            service.RequestDoorAccess(doorId, callback);
        }
    }
}
