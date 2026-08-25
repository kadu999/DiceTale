using System.Collections.Generic;
using UnityEngine;

namespace DiceTale
{
    public class PlayerMover : MonoBehaviour
    {
        [SerializeField]
        private float moveSpeed = 5f;

        private List<Vector3> path = new List<Vector3>();
        private int currentPathIndex;
        private bool isMoving;

        public void MoveTo(Vector3 targetPosition)
        {
            var gridMap = Object.FindFirstObjectByType<GridMap>();
            if (gridMap == null)
            {
                path.Clear();
                path.Add(targetPosition);
                currentPathIndex = 0;
                isMoving = true;
                return;
            }

            var startGrid = gridMap.WorldToGrid(transform.position);
            var endGrid = gridMap.WorldToGrid(targetPosition);

            var gridPath = gridMap.FindPath(startGrid, endGrid);
            if (gridPath == null)
            {
                Debug.Log($"无法移动到目标位置：{endGrid} 被阻挡或不可达");
                isMoving = false;
                path.Clear();
                return;
            }

            path.Clear();

            if (gridPath.Count == 0)
            {
                path.Add(targetPosition);
            }
            else
            {
                for (int i = 0; i < gridPath.Count; i++)
                {
                    path.Add(i == gridPath.Count - 1 ? targetPosition : gridMap.GridToWorld(gridPath[i]));
                }
            }

            currentPathIndex = 0;
            isMoving = true;
        }

        public void Stop()
        {
            isMoving = false;
            path.Clear();
        }

        private void Update()
        {
            if (!isMoving || path.Count == 0)
            {
                return;
            }

            var target = path[currentPathIndex];

            var gridMap = Object.FindFirstObjectByType<GridMap>();
            if (gridMap != null && !gridMap.IsWalkable(gridMap.WorldToGrid(target)))
            {
                isMoving = false;
                path.Clear();
                return;
            }

            transform.position = Vector3.MoveTowards(transform.position, target, moveSpeed * Time.deltaTime);

            if (Vector3.Distance(transform.position, target) < 0.01f)
            {
                currentPathIndex++;
                if (currentPathIndex >= path.Count)
                {
                    isMoving = false;
                    path.Clear();
                }
            }
        }
    }
}
