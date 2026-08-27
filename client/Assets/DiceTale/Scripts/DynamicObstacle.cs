using System.Collections.Generic;
using UnityEngine;

namespace DiceTale
{
    /// <summary>
    /// 动态阻挡：依赖 <see cref="BoxCollider2D"/>。
    /// 物体激活时在 <see cref="GridMap"/> 上占据动态阻挡格子（寻路/移动判定被挡），
    /// 物体隐藏（SetActive(false) / 组件禁用）或销毁时自动取消阻挡。
    /// 物理碰撞由 BoxCollider2D 决定（是否 Trigger 按需配置），网格阻挡由本组件负责。
    /// 物体移动或网格数据变化后，可调用 <see cref="RefreshBlocking"/> 重新计算占用格子。
    /// </summary>
    [RequireComponent(typeof(BoxCollider2D))]
    public class DynamicObstacle : MonoBehaviour
    {
        private GridMap gridMap;
        private readonly List<Vector2Int> registeredObstacles = new List<Vector2Int>();

        private void OnEnable()
        {
            RegisterBlocking();
        }

        private void OnDisable()
        {
            UnregisterBlocking();
        }

        /// <summary>重新计算并注册阻挡（物体移动后或网格加载/尺寸变化后手动调用）。</summary>
        public void RefreshBlocking()
        {
            UnregisterBlocking();
            RegisterBlocking();
        }

        private void RegisterBlocking()
        {
            if (gridMap == null)
            {
                gridMap = Object.FindFirstObjectByType<GridMap>();
            }

            if (gridMap == null)
            {
                return;
            }

            UnregisterBlocking();

            var collider = GetComponent<BoxCollider2D>();
            if (collider == null)
            {
                return;
            }

            var bounds = collider.bounds;
            var min = gridMap.WorldToGrid(bounds.min);
            var max = gridMap.WorldToGrid(bounds.max);

            for (int x = min.x; x <= max.x; x++)
            {
                for (int y = min.y; y <= max.y; y++)
                {
                    var gridPos = new Vector2Int(x, y);
                    gridMap.AddDynamicObstacle(gridPos);
                    registeredObstacles.Add(gridPos);
                }
            }
        }

        private void UnregisterBlocking()
        {
            if (registeredObstacles.Count == 0)
            {
                return;
            }

            if (gridMap != null)
            {
                foreach (var gridPos in registeredObstacles)
                {
                    gridMap.RemoveDynamicObstacle(gridPos);
                }
            }

            registeredObstacles.Clear();
        }
    }
}
