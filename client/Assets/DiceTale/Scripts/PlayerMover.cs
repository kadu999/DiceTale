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
            if (gridPath == null || gridPath.Count == 0)
            {
                isMoving = false;
                path.Clear();
                return;
            }

            path.Clear();
            foreach (var gridPos in gridPath)
            {
                path.Add(gridMap.GridToWorld(gridPos));
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
