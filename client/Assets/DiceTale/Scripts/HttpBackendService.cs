using System;
using System.Collections;
using UnityEngine;
using UnityEngine.Networking;

namespace DiceTale
{
    public class HttpBackendService : IBackendService
    {
        private readonly string baseUrl;
        private readonly MonoBehaviour coroutineRunner;

        public HttpBackendService(string baseUrl, MonoBehaviour coroutineRunner)
        {
            this.baseUrl = baseUrl;
            this.coroutineRunner = coroutineRunner;
        }

        public void RequestDoorAccess(string doorId, Action<bool> callback)
        {
            coroutineRunner.StartCoroutine(RequestDoorAccessCoroutine(doorId, callback));
        }

        private IEnumerator RequestDoorAccessCoroutine(string doorId, Action<bool> callback)
        {
            var url = $"{baseUrl}/doors/{doorId}/access";
            using (var request = UnityWebRequest.Get(url))
            {
                yield return request.SendWebRequest();

                var allowed = false;
                if (request.result == UnityWebRequest.Result.Success)
                {
                    bool.TryParse(request.downloadHandler.text, out allowed);
                }
                else
                {
                    Debug.LogWarning($"[HttpBackend] Door access request failed: {request.error}");
                }

                callback?.Invoke(allowed);
            }
        }
    }
}
