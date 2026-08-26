using System.Collections.Generic;
using UnityEngine;

namespace DiceTale
{
    /// <summary>
    /// 迷雾区域（探索揭示）：
    /// Fog1~Fog5 各代表一个雾区域。每个区域默认被不透明雾遮挡，
    /// 玩家进入某个区域后，仅该区域的雾散开（揭示），其他区域保持遮挡。
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

        private static readonly GridCellType[] FogTypes =
        {
            GridCellType.Fog1, GridCellType.Fog2, GridCellType.Fog3,
            GridCellType.Fog4, GridCellType.Fog5,
        };

        private GridMap gridMap;
        private readonly Dictionary<GridCellType, SpriteRenderer> fogAreas = new Dictionary<GridCellType, SpriteRenderer>();
        private readonly HashSet<GridCellType> revealedAreas = new HashSet<GridCellType>();
        private float checkTimer;

        private void Start()
        {
            gridMap = GetComponent<GridMap>();
            BuildFogAreas();
        }

        private void Update()
        {
            checkTimer -= Time.deltaTime;
            if (checkTimer > 0f)
            {
                return;
            }

            checkTimer = checkInterval;
            CheckPlayerFogArea();
        }

        private void OnDestroy()
        {
            foreach (var renderer in fogAreas.Values)
            {
                if (renderer != null && renderer.sprite != null && renderer.sprite.texture != null)
                {
                    Destroy(renderer.sprite.texture);
                }
            }
            fogAreas.Clear();
        }

        /// <summary>为每个雾等级（区域）生成一个雾层，默认不透明遮挡，玩家进入该区域后散开。</summary>
        private void BuildFogAreas()
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

            foreach (var fogType in FogTypes)
            {
                var colors = new Color[gridSize.x * gridSize.y];
                var cellCount = 0;

                for (int y = 0; y < gridSize.y; y++)
                {
                    for (int x = 0; x < gridSize.x; x++)
                    {
                        if (cellGrid[x, y] == fogType)
                        {
                            colors[y * gridSize.x + x] = new Color(fogColor.r, fogColor.g, fogColor.b, 1f);
                            cellCount++;
                        }
                    }
                }

                if (cellCount == 0)
                {
                    continue;
                }

                // 边缘羽化（地图四边不平滑）
                SmoothFogAlpha(colors, gridSize.x, gridSize.y, edgeSmoothPasses);

                var texture = new Texture2D(gridSize.x, gridSize.y, TextureFormat.RGBA32, false);
                texture.filterMode = FilterMode.Bilinear;
                texture.wrapMode = TextureWrapMode.Clamp;
                texture.name = $"FogArea_{fogType}";
                texture.SetPixels(colors);
                texture.Apply();

                var sprite = Sprite.Create(
                    texture,
                    new Rect(0, 0, gridSize.x, gridSize.y),
                    new Vector2(0.5f, 0.5f),
                    pixelsPerUnit
                );

                var go = new GameObject("FogArea_" + fogType);
                go.transform.SetParent(transform, false);
                go.transform.localPosition = Vector3.zero;
                go.transform.localScale = Vector3.one;

                var renderer = go.AddComponent<SpriteRenderer>();
                renderer.sprite = sprite;
                renderer.material = new Material(Shader.Find("Sprites/Default"));
                renderer.sortingOrder = fogSortingOrder;
                renderer.enabled = true; // 默认遮挡，玩家进入该区域后散开

                fogAreas[fogType] = renderer;
                Debug.Log($"[FogOfWar] area {fogType}: {cellCount} cells, blocking");
            }

            Debug.Log($"[FogOfWar] {name}: {fogAreas.Count} fog area(s) built");
        }

        /// <summary>检查玩家所在格子：进入某个雾区域则只散开该区域。</summary>
        private void CheckPlayerFogArea()
        {
            if (gridMap == null)
            {
                return;
            }

            var player = CharacterManager.Instance != null ? CharacterManager.Instance.CurrentPlayer : null;
            if (player == null)
            {
                return;
            }

            var gridPos = gridMap.WorldToGrid(player.transform.position);
            var type = gridMap.GetCellType(gridPos);

            if (!IsFogType(type) || revealedAreas.Contains(type))
            {
                return;
            }

            revealedAreas.Add(type);
            if (fogAreas.TryGetValue(type, out var renderer) && renderer != null)
            {
                renderer.enabled = false; // 仅该区域雾散开
                Debug.Log($"[FogOfWar] area {type} revealed (fog cleared) by player at {gridPos}");
            }
        }

        /// <summary>对雾纹理的 alpha 通道做多次 3x3 均值模糊（地图四边不平滑）。</summary>
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
                        // 模糊窗口（3x3）触及地图边界的格子不平滑，防止羽化传染到地图边缘
                        bool touchesBorder = x <= 1 || x >= width - 2 || y <= 1 || y >= height - 2;
                        if (touchesBorder)
                        {
                            next[y * width + x] = alphaMap[y * width + x];
                            continue;
                        }

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
