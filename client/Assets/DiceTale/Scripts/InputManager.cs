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
