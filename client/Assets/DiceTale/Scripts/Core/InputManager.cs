using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.InputSystem;

namespace DiceTale
{
    public class InputManager : MonoBehaviour
    {
        [SerializeField]
        private Camera playerCamera;

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

            // 点击 UI（玩家切换按钮等）时不移动玩家
            if (EventSystem.current != null && EventSystem.current.IsPointerOverGameObject())
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

        /// <summary>鼠标当前世界坐标（投射到网格所在 XZ 平面，供其他系统查询）。</summary>
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

            return ScreenToGridPlane(camera, mouse.position.ReadValue());
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

            MovePlayerTo(ScreenToGridPlane(camera, mouse.position.ReadValue()));
        }

        /// <summary>把屏幕坐标投射到网格所在 XZ 平面（Y 取 GridMap 的高度；无 GridMap 时取 0）。</summary>
        private static Vector3 ScreenToGridPlane(Camera camera, Vector2 screenPosition)
        {
            var planeY = 0f;
            var gridMap = Object.FindFirstObjectByType<GridMap>();
            if (gridMap != null)
            {
                planeY = gridMap.transform.position.y;
            }

            var plane = new Plane(Vector3.up, new Vector3(0f, planeY, 0f));
            var ray = camera.ScreenPointToRay(screenPosition);
            if (plane.Raycast(ray, out var distance))
            {
                return ray.GetPoint(distance);
            }

            // 视线与平面平行（罕见）：退回正交投影结果
            var fallback = camera.ScreenToWorldPoint(screenPosition);
            fallback.y = planeY;
            return fallback;
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
