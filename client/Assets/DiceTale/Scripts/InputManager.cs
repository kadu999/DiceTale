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

        /// <summary>鼠标右键是否按住（供其他系统查询，统一走 InputManager）。</summary>
        public bool IsRightMouseHeld
        {
            get
            {
                var mouse = Mouse.current;
                return mouse != null && mouse.rightButton.isPressed;
            }
        }

        /// <summary>鼠标当前世界坐标（z=0，供其他系统查询）。</summary>
        public Vector3 GetMouseWorldPosition()
        {
            var camera = playerCamera != null ? playerCamera : Camera.main;
            if (camera == null)
            {
                return Vector3.zero;
            }

            var mouse = Mouse.current;
            if (mouse == null)
            {
                return Vector3.zero;
            }

            var world = camera.ScreenToWorldPoint(mouse.position.ReadValue());
            world.z = 0f;
            return world;
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

            // A* 判断是否可达（不可达则不移动）
            var gridMap = Object.FindFirstObjectByType<GridMap>();
            if (gridMap != null)
            {
                var startGrid = gridMap.WorldToGrid(player.transform.position);
                var endGrid = gridMap.WorldToGrid(targetPosition);
                var gridPath = gridMap.FindPath(startGrid, endGrid);
                if (gridPath == null)
                {
                    Debug.Log($"无法移动到目标位置：{endGrid} 被阻挡或不可达");
                    return;
                }
            }

            // 可达：直接瞬移过去（不播放移动过程）
            player.transform.position = targetPosition;
            player.ReportPosition();
        }
    }
}
