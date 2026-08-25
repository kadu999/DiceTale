using UnityEngine;
using UnityEngine.InputSystem;

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
            bool pressed = false;

            var mouse = Mouse.current;
            if (mouse != null && mouse.leftButton.wasPressedThisFrame)
            {
                pressed = true;
            }

            var touchscreen = Touchscreen.current;
            if (touchscreen != null && touchscreen.primaryTouch.press.wasPressedThisFrame)
            {
                pressed = true;
            }

            if (pressed)
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

            var pointer = Pointer.current;
            if (pointer == null)
            {
                return;
            }

            var ray = camera.ScreenPointToRay(pointer.position.ReadValue());
            var hit = Physics2D.Raycast(ray.origin, ray.direction, maxDistance);
            if (hit.collider == null)
            {
                return;
            }

            var interactable = hit.collider.GetComponentInParent<Interactable>();
            if (interactable == null)
            {
                return;
            }

            var player = CharacterManager.Instance?.CurrentPlayer;
            interactable.Interact(player);
        }
    }
}
