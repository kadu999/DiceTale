using System.Collections.Generic;
using UnityEngine;

namespace DiceTale
{
    /// <summary>
    /// 迷雾区域（探索揭示）：
    /// 所有雾标记（Fog1~Fog5）合成一块整体雾，边缘整体羽化（合在一起）；
    /// 但揭示按区域分开——玩家进入某个区域，只挖掉该区域的雾，其他区域保持遮挡。
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

        [Tooltip("允许按住鼠标右键擦除鼠标所指的雾（逐格擦除）")]
        [SerializeField]
        private bool allowRightClickErase = true;

        private static readonly GridCellType[] FogTypes =
        {
            GridCellType.Fog1, GridCellType.Fog2, GridCellType.Fog3,
            GridCellType.Fog4, GridCellType.Fog5,
        };

        private GridMap gridMap;
        private SpriteRenderer fogRenderer;
        private Texture2D fogTexture;
        private Color[] fogColors;
        private int width;
        private int height;
        private readonly Dictionary<GridCellType, List<int>> cellsByType = new Dictionary<GridCellType, List<int>>();
        private readonly HashSet<GridCellType> revealedAreas = new HashSet<GridCellType>();
        private float checkTimer;

        private void Start()
        {
            gridMap = GetComponent<GridMap>();
            BuildFog();
        }

        private void Update()
        {
            // 右键擦除：每帧检测，保证拖动擦除流畅
            if (allowRightClickErase)
            {
                HandleRightClickErase();
            }

            // 玩家进入区域揭示：节流即可
            checkTimer -= Time.deltaTime;
            if (checkTimer > 0f)
            {
                return;
            }

            checkTimer = checkInterval;
            CheckPlayerFogArea();
        }

        /// <summary>按住鼠标右键，逐格擦除鼠标所指的雾。</summary>
        private void HandleRightClickErase()
        {
            if (gridMap == null || fogColors == null)
            {
                return;
            }

            var input = Object.FindFirstObjectByType<InputManager>();
            if (input == null || !input.IsRightMouseHeld)
            {
                return;
            }

            var gridPos = gridMap.WorldToGrid(input.GetMouseWorldPosition());

            // 只擦除雾格子
            if (!IsFogType(gridMap.GetCellType(gridPos)))
            {
                return;
            }

            var index = gridPos.y * width + gridPos.x;
            if (index < 0 || index >= fogColors.Length)
            {
                return;
            }

            var color = fogColors[index];
            if (color.a <= 0f)
            {
                return;
            }

            fogColors[index] = new Color(color.r, color.g, color.b, 0f);
            RebuildTexture();
            Debug.Log($"[FogOfWar] erased fog cell at {gridPos}");
        }

        private void OnDestroy()
        {
            if (fogTexture != null)
            {
                Destroy(fogTexture);
            }
        }

        /// <summary>生成整体雾纹理：所有雾格子合并成一块，整体羽化，默认遮挡。</summary>
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

            width = gridSize.x;
            height = gridSize.y;
            var gridWidth = gridMap.GridWidth;
            var pixelsPerUnit = gridWidth > 0f ? width / gridWidth : 1f;

            fogColors = new Color[width * height];
            cellsByType.Clear();
            var fogCells = 0;

            for (int y = 0; y < height; y++)
            {
                for (int x = 0; x < width; x++)
                {
                    var type = cellGrid[x, y];
                    if (!IsFogType(type))
                    {
                        continue;
                    }

                    var index = y * width + x;
                    fogColors[index] = new Color(fogColor.r, fogColor.g, fogColor.b, 1f);
                    fogCells++;

                    if (!cellsByType.TryGetValue(type, out var list))
                    {
                        list = new List<int>();
                        cellsByType[type] = list;
                    }

                    list.Add(index);
                }
            }

            Debug.Log($"[FogOfWar] {name}: fog cells={fogCells}, grid={width}x{height}");

            if (fogCells == 0)
            {
                return;
            }

            fogTexture = new Texture2D(width, height, TextureFormat.RGBA32, false);
            fogTexture.filterMode = FilterMode.Bilinear;
            fogTexture.wrapMode = TextureWrapMode.Clamp;
            fogTexture.name = "FogArea";

            var go = new GameObject("FogOverlay");
            go.transform.SetParent(transform, false);
            go.transform.localPosition = Vector3.zero;
            go.transform.localScale = Vector3.one;

            fogRenderer = go.AddComponent<SpriteRenderer>();
            fogRenderer.sprite = Sprite.Create(
                fogTexture,
                new Rect(0, 0, width, height),
                new Vector2(0.5f, 0.5f),
                pixelsPerUnit
            );
            fogRenderer.material = new Material(Shader.Find("Sprites/Default"));
            fogRenderer.sortingOrder = fogSortingOrder;
            fogRenderer.enabled = true;

            RebuildTexture();
            Debug.Log($"[FogOfWar] fog overlay created (blocking)");
        }

        /// <summary>基于当前雾 alpha 状态重羽化并更新纹理。</summary>
        private void RebuildTexture()
        {
            if (fogTexture == null || fogColors == null)
            {
                return;
            }

            var colors = (Color[])fogColors.Clone();
            SmoothFogAlpha(colors, width, height, edgeSmoothPasses);

            fogTexture.SetPixels(colors);
            fogTexture.Apply();
        }

        /// <summary>检查玩家所在格子：进入某个雾区域，只挖掉该区域的雾。</summary>
        private void CheckPlayerFogArea()
        {
            if (gridMap == null || fogColors == null)
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

            // 只挖掉该区域的雾格子，其他区域保持遮挡
            if (cellsByType.TryGetValue(type, out var indices))
            {
                for (int i = 0; i < indices.Count; i++)
                {
                    var color = fogColors[indices[i]];
                    fogColors[indices[i]] = new Color(color.r, color.g, color.b, 0f);
                }

                RebuildTexture();
                Debug.Log($"[FogOfWar] area {type} revealed (cleared) by player at {gridPos}, remaining areas intact");
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
