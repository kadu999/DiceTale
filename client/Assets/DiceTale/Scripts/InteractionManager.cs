using UnityEngine;

namespace DiceTale
{
    public class InteractionManager : MonoBehaviour
    {
        [SerializeField]
        private Camera playerCamera;

        [SerializeField]
        private float maxDistance = 3f;

        private void Update()
        {
            if (Input.GetMouseButtonDown(0) || (Input.touchCount > 0 && Input.GetTouch(0).phase == TouchPhase.Began))
            {
                TryInteract();
            }
        }

        public void TryInteract()
        {
            var camera = playerCamera != null ? playerCamera : Camera.main;
            if (camera == null)
            {
                return;
            }

            var ray = GetRay(camera);
            if (!Physics.Raycast(ray, out var hit, maxDistance))
            {
                return;
            }

            var interactable = hit.collider.GetComponentInParent<Interactable>();
            if (interactable == null)
            {
                return;
            }

            var player = Object.FindFirstObjectByType<Player>();
            interactable.Interact(player);
        }

        private Ray GetRay(Camera camera)
        {
            if (Input.touchCount > 0)
            {
                return camera.ScreenPointToRay(Input.GetTouch(0).position);
            }

            return camera.ScreenPointToRay(Input.mousePosition);
        }
    }
}
