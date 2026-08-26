using UnityEngine;
using UnityEngine.InputSystem;

namespace DiceTale
{
    public class InputManager : MonoBehaviour
    {
        [SerializeField]
        private Camera playerCamera;

        [SerializeField]
        private float maxDistance = 100f;

        private void Update()
        {
            var game = Object.FindFirstObjectByType<Game>();
            if (game != null && !game.CanInteract)
            {
                return;
            }

            var mouse = Mouse.current;
            if (mouse == null || !mouse.leftButton.wasPressedThisFrame)
            {
                return;
            }

            HandleClick();
        }

        public void HandleClick()
        {
            var camera = playerCamera != null ? playerCamera : Camera.main;
            if (camera == null)
            {
                return;
            }

            var mouse = Mouse.current;
            if (mouse == null)
            {
                return;
            }

            var screenPosition = mouse.position.ReadValue();
            var worldPosition = camera.ScreenToWorldPoint(screenPosition);
            worldPosition.z = 0f;

            var ray = camera.ScreenPointToRay(screenPosition);
            var hit = Physics2D.Raycast(ray.origin, ray.direction, maxDistance);

            if (hit.collider != null)
            {
                MovePlayerTo(worldPosition);
                return;
            }

            MovePlayerTo(worldPosition);
        }

        private void MovePlayerTo(Vector3 targetPosition)
        {
            var player = CharacterManager.Instance?.CurrentPlayer;
            if (player == null)
            {
                return;
            }

            var mover = player.GetComponent<PlayerMover>();
            if (mover != null)
            {
                mover.MoveTo(targetPosition);
            }
            else
            {
                player.transform.position = targetPosition;
            }
        }
    }
}
