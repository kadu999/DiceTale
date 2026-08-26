using UnityEngine;

namespace DiceTale
{
    /// <summary>
    /// 迷雾区域（探索揭示）：
    /// 所有标记了雾（Fog1~Fog5）的格子构成一个整体雾区域。
    /// 未探索时整个雾区域被不透明雾遮挡，玩家进入任意雾格子后整个雾散开、被揭示。
    /// 需要与 GridMap 同物体。
    /// </summary>
    [RequireComponent(typeof(GridMap))]
    public class FogOfWar : MonoBehaviour
    {
        [SerializeField]
        private Color fogColor = new Color(0.85f, 0.88f, 0.92f, 1f);

        [SerializeField]
        private int fogSortingOrder = 1;

        [SerializeField]
        private float checkInterval = 0.2f;

        [Tooltip("雾边缘羽化强度（0=不羽化）")]
        [SerializeField]
        private int edgeSmoothPasses = 2;

        private GridMap gridMap;
        private SpriteRenderer fogRenderer;
        private bool revealed;

        private void Start()
        {
            gridMap = GetComponent<GridMap>();
            BuildFog();
        }

        private void Update()
        {
            if (revealed)
            {
                return;
            }

            checkTimer -= Time.deltaTime;
            if (checkTimer > 0f)
            {
                return;
            }

            checkTimer = checkInterval;
            CheckPlayerInFog();
        }

        private float checkTimer;

        private void OnDestroy()
        {
            if (fogRenderer != null && fogRenderer.sprite != null && fogRenderer.sprite.texture != null)
            {
                Destroy(fogRenderer.sprite.texture);
            }
        }

        /// <summary>生成整体雾层：所有雾标记格子一块纹理，默认不透明遮挡。</summary>
        private void BuildFog()
        {
            if (gridMap == null)
            {
                Debug.LogWarning("[FogOfWar] GridMap missing on " + name);
                return;
            }

            var gridSize = gridMap.GridSize;
            var cellGrid = gridMap.CellGrid;
            if (gridSize.x <= 0 || gridSize.y <= 0 || cellGrid == null)
            {
                Debug.LogWarning("[FogOfWar] Grid data not ready on " + name);
                return;
            }

            var gridWidth = gridMap.GridWidth;
            var pixelsPerUnit = gridWidth > 0f ? gridSize.x / gridWidth : 1f;

            // 收集所有雾格子（Fog1~Fog5 都是雾区域的一部分）
            var colors = new Color[gridSize.x * gridSize.y];
            var fogCells = 0;
            for (int y = 0; y < gridSize.y; y++)
            {
                for (int x = 0; x < gridSize.x; x++)
                {
                    if (IsFogType(cellGrid[x, y]))
                    {
                        colors[y * gridSize.x + x] = new Color(fogColor.r, fogColor.g, fogColor.b, 1f);
                        fogCells++;
                    }
                }
            }

            Debug.Log($"[FogOfWar] {name}: fog cells={fogCells}, grid={gridSize.x}x{gridSize.y}");

            if (fogCells == 0)
            {
                return;
            }

            // 整体边缘羽化
            SmoothFogAlpha(colors, gridSize.x, gridSize.y, edgeSmoothPasses);

            var texture = new Texture2D(gridSize.x, gridSize.y, TextureFormat.RGBA32, false);
            texture.filterMode = FilterMode.Bilinear;
            texture.wrapMode = TextureWrapMode.Clamp;
            texture.name = "FogArea";
            texture.SetPixels(colors);
            texture.Apply();

            var sprite = Sprite.Create(
                texture,
                new Rect(0, 0, gridSize.x, gridSize.y),
                new Vector2(0.5f, 0.5f),
                pixelsPerUnit
            );

            var go = new GameObject("FogOverlay");
            go.transform.SetParent(transform, false);
            go.transform.localPosition = Vector3.zero;
            go.transform.localScale = Vector3.one;

            fogRenderer = go.AddComponent<SpriteRenderer>();
            fogRenderer.sprite = sprite;
            fogRenderer.material = new Material(Shader.Find("Sprites/Default"));
            fogRenderer.sortingOrder = fogSortingOrder;
            fogRenderer.enabled = true; // 默认遮挡，玩家进入后整体散开

            Debug.Log($"[FogOfWar] fog overlay created: {fogCells} cells (blocking)");
        }

        /// <summary>玩家进入任意雾格子 → 整个雾区域散开（揭示）。</summary>
        private void CheckPlayerInFog()
        {
            if (gridMap == null || fogRenderer == null)
            {
                return;
            }

            var player = CharacterManager.Instance != null ? CharacterManager.Instance.CurrentPlayer : null;
            if (player == null)
            {
                return;
            }

            var gridPos = gridMap.WorldToGrid(player.transform.position);
            if (!IsFogType(gridMap.GetCellType(gridPos)))
            {
                return;
            }

            revealed = true;
            fogRenderer.enabled = false; // 整个雾散开
            Debug.Log($"[FogOfWar] fog revealed (cleared) by player at {gridPos}");
        }

        /// <summary>对雾纹理的 alpha 通道做多次 3x3 均值模糊，让边缘柔和（羽化）。</summary>
        private static void SmoothFogAlpha(Color[] colors, int width, int height, int passes)
        {
            if (passes <= 0)
            {
                return;
            }

            var alphaMap = new float[width * height];
            for (int i = 0; i < colors.Length; i++)
            {
                alphaMap[i] = colors[i].a;
            }

            for (int pass = 0; pass < passes; pass++)
            {
                var next = new float[width * height];
                for (int y = 0; y < height; y++)
                {
                    for (int x = 0; x < width; x++)
                    {
                        float sum = 0f;
                        int count = 0;
                        for (int dy = -1; dy <= 1; dy++)
                        {
                            for (int dx = -1; dx <= 1; dx++)
                            {
                                int nx = x + dx;
                                int ny = y + dy;
                                if (nx >= 0 && nx < width && ny >= 0 && ny < height)
                                {
                                    sum += alphaMap[ny * width + nx];
                                    count++;
                                }
                            }
                        }

                        next[y * width + x] = sum / count;
                    }
                }

                alphaMap = next;
            }

            for (int i = 0; i < colors.Length; i++)
            {
                colors[i] = new Color(colors[i].r, colors[i].g, colors[i].b, alphaMap[i]);
            }
        }

        private static bool IsFogType(GridCellType type)
        {
            switch (type)
            {
                case GridCellType.Fog1:
                case GridCellType.Fog2:
                case GridCellType.Fog3:
                case GridCellType.Fog4:
                case GridCellType.Fog5:
                    return true;
                default:
                    return false;
            }
        }
    }
}
