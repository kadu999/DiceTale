using UnityEngine;
using UnityEngine.InputSystem;

namespace DiceTale
{
    public class InteractionManager : MonoBehaviour
    {
        [SerializeField]
        private Camera playerCamera;

        [SerializeField]
        private float maxDistance = 100f;

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
                HandleClick();
            }
        }

        public void HandleClick()
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

            var screenPosition = pointer.position.ReadValue();
            var worldPosition = camera.ScreenToWorldPoint(screenPosition);
            worldPosition.z = 0f;

            var ray = camera.ScreenPointToRay(screenPosition);
            var hit = Physics2D.Raycast(ray.origin, ray.direction, maxDistance);

            if (hit.collider != null)
            {
                var item = hit.collider.GetComponentInParent<Item>();
                if (item != null)
                {
                    var player = CharacterManager.Instance?.CurrentPlayer;
                    item.Interact(player);
                    return;
                }

                // 点到 Door 或其他物体时，只移动到点击位置，不立即触发
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
