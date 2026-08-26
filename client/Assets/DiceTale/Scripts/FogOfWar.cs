using UnityEngine;

namespace DiceTale
{
    /// <summary>
    /// 迷雾：只在地图网格标记了 Fog1~Fog5 的格子处显示雾（按等级浓淡），
    /// 未标记的区域保持清晰可见。需要与 GridMap 同物体。
    /// </summary>
    [RequireComponent(typeof(GridMap))]
    public class FogOfWar : MonoBehaviour
    {
        [SerializeField]
        private Color fogColor = new Color(0.85f, 0.88f, 0.92f, 1f);

        [SerializeField]
        private int fogSortingOrder = 1;

        private GridMap gridMap;
        private SpriteRenderer fogRenderer;

        private void Start()
        {
            gridMap = GetComponent<GridMap>();
            BuildStaticFog();
        }

        private void OnDestroy()
        {
            if (fogRenderer != null && fogRenderer.sprite != null)
            {
                var tex = fogRenderer.sprite.texture;
                if (tex != null)
                {
                    Destroy(tex);
                }
            }
        }

        /// <summary>按网格标记生成静态雾：只有 Fog1~Fog5 格子有雾，其余透明。</summary>
        private void BuildStaticFog()
        {
            if (gridMap == null)
            {
                Debug.LogWarning("[FogOfWar] GridMap missing on " + name);
                return;
            }

            var gridSize = gridMap.GridSize;
            if (gridSize.x <= 0 || gridSize.y <= 0)
            {
                Debug.LogWarning("[FogOfWar] Invalid grid size on " + name + ": " + gridSize);
                return;
            }

            var fogCells = 0;
            var colors = new Color[gridSize.x * gridSize.y];
            foreach (var pair in gridMap.GetCellTypes())
            {
                var alpha = GetFogAlpha(pair.Value);
                if (alpha <= 0f)
                {
                    continue;
                }

                fogCells++;
                var index = pair.Key.y * gridSize.x + pair.Key.x;
                colors[index] = new Color(fogColor.r, fogColor.g, fogColor.b, alpha);
            }

            Debug.Log($"[FogOfWar] {name}: grid={gridSize.x}x{gridSize.y}, fog cells={fogCells}, gridW={gridMap.GridWidth}, gridH={gridMap.GridHeight}");

            if (fogCells == 0)
            {
                return;
            }

            var texture = new Texture2D(gridSize.x, gridSize.y, TextureFormat.RGBA32, false);
            texture.filterMode = FilterMode.Point;
            texture.wrapMode = TextureWrapMode.Clamp;
            texture.name = "FogMask_" + name;

            texture.SetPixels(colors);
            texture.Apply();

            var sprite = Sprite.Create(
                texture,
                new Rect(0, 0, gridSize.x, gridSize.y),
                new Vector2(0.5f, 0.5f),
                1f
            );

            var go = new GameObject("FogOverlay");
            go.transform.SetParent(transform, false);
            go.transform.localPosition = Vector3.zero;
            // 纹理每个像素对应一个格子：缩放铺满整个网格
            go.transform.localScale = new Vector3(gridMap.GridWidth, gridMap.GridHeight, 1f);

            fogRenderer = go.AddComponent<SpriteRenderer>();
            fogRenderer.sprite = sprite;
            fogRenderer.material = new Material(Shader.Find("Sprites/Default"));
            fogRenderer.sortingOrder = fogSortingOrder;
        }

        /// <summary>雾1~雾5 只是区域标记，运行时所有雾效果一致（统一浓淡）。</summary>
        private static float GetFogAlpha(GridCellType type)
        {
            switch (type)
            {
                case GridCellType.Fog1:
                case GridCellType.Fog2:
                case GridCellType.Fog3:
                case GridCellType.Fog4:
                case GridCellType.Fog5:
                    return 0.6f;
                default:
                    return 0f;
            }
        }
    }
}
