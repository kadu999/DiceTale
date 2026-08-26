using System.Collections.Generic;
using UnityEngine;

namespace DiceTale
{
    /// <summary>
    /// 迷雾区域（探索揭示，GPU 渲染）：
    /// 所有雾标记（Fog1~Fog5）合成一块整体雾，边缘羽化在 GPU 上通过模糊 shader 完成（静态雾底）；
    /// 揭示按区域分开——玩家进入某个区域，通过遮罩把该区域整块切除（雾干净消失，不影响其他区域）。
    /// 支持按住鼠标右键逐格擦除（输入经 InputManager）。
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

        [Tooltip("允许按住鼠标右键擦除鼠标所指的雾（逐格擦除）")]
        [SerializeField]
        private bool allowRightClickErase = true;

        [Tooltip("雾边缘羽化强度（GPU 模糊次数，2=柔和，越大越柔）")]
        [SerializeField]
        private int blurPasses = 2;

        private static readonly GridCellType[] FogTypes =
        {
            GridCellType.Fog1, GridCellType.Fog2, GridCellType.Fog3,
            GridCellType.Fog4, GridCellType.Fog5,
        };

        private GridMap gridMap;

        // 静态雾底（格子级）：雾格子 alpha=1，仅用于 GPU 羽化，不随揭示变化
        private Texture2D baseTexture;
        private int width;
        private int height;

        // 揭示遮罩（格子级）：alpha 1=未揭示，0=已揭示/擦除
        private Texture2D maskTexture;

        // GPU 羽化链
        private RenderTexture[] blurRTs;
        private Material blurMaterial;
        private Material combineMaterial;

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
            if (checkTimer <= 0f)
            {
                checkTimer = checkInterval;
                CheckPlayerFogArea();
            }

            // GPU 羽化静态雾底（每帧从 base 重算，无累积）
            if (baseTexture != null && blurRTs != null && blurRTs.Length > 0 && blurMaterial != null)
            {
                Graphics.Blit(baseTexture, blurRTs[0], blurMaterial);
                for (int i = 1; i < blurRTs.Length; i++)
                {
                    Graphics.Blit(blurRTs[i - 1], blurRTs[i], blurMaterial);
                }

                combineMaterial.mainTexture = blurRTs[blurRTs.Length - 1];
            }
        }

        private void OnDestroy()
        {
            if (baseTexture != null)
            {
                Destroy(baseTexture);
            }

            if (maskTexture != null)
            {
                Destroy(maskTexture);
            }

            if (blurRTs != null)
            {
                for (int i = 0; i < blurRTs.Length; i++)
                {
                    if (blurRTs[i] != null)
                    {
                        blurRTs[i].Release();
                        Destroy(blurRTs[i]);
                    }
                }
            }
        }

        /// <summary>生成静态雾底 + 揭示遮罩 + GPU 羽化链 + 合成显示层。</summary>
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
            var gridHeight = gridMap.GridHeight;

            // 1. 静态雾底：所有雾格子 alpha=1
            baseTexture = new Texture2D(width, height, TextureFormat.RGBA32, false);
            baseTexture.filterMode = FilterMode.Point;
            baseTexture.wrapMode = TextureWrapMode.Clamp;
            baseTexture.name = "FogBase";

            var baseColors = new Color[width * height];
            var fogCells = 0;
            cellsByType.Clear();

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
                    baseColors[index] = new Color(fogColor.r, fogColor.g, fogColor.b, 1f);
                    fogCells++;

                    if (!cellsByType.TryGetValue(type, out var list))
                    {
                        list = new List<int>();
                        cellsByType[type] = list;
                    }

                    list.Add(index);
                }
            }

            baseTexture.SetPixels(baseColors);
            baseTexture.Apply();

            // 2. 揭示遮罩：初始全未揭示（alpha=1）
            maskTexture = new Texture2D(width, height, TextureFormat.RGBA32, false);
            maskTexture.filterMode = FilterMode.Point;
            maskTexture.wrapMode = TextureWrapMode.Clamp;
            maskTexture.name = "RevealMask";

            var maskColors = new Color[width * height];
            for (int i = 0; i < maskColors.Length; i++)
            {
                maskColors[i] = new Color(1f, 1f, 1f, 1f);
            }

            maskTexture.SetPixels(maskColors);
            maskTexture.Apply();

            Debug.Log($"[FogOfWar] {name}: fog cells={fogCells}, grid={width}x{height}");

            if (fogCells == 0)
            {
                return;
            }

            // 3. GPU 羽化链（静态雾底）
            blurRTs = new RenderTexture[Mathf.Max(1, blurPasses)];
            for (int i = 0; i < blurRTs.Length; i++)
            {
                blurRTs[i] = new RenderTexture(width * 2, height * 2, 0, RenderTextureFormat.ARGB32);
                blurRTs[i].filterMode = FilterMode.Bilinear;
                blurRTs[i].wrapMode = TextureWrapMode.Clamp;
            }

            var blurShader = Shader.Find("DiceTale/FogBlur");
            if (blurShader == null)
            {
                Debug.LogError("[FogOfWar] Shader 'DiceTale/FogBlur' not found!");
                return;
            }

            blurMaterial = new Material(blurShader);
            blurMaterial.SetVector("_GridSize", new Vector4(width, height, 0f, 0f));

            // 4. 合成显示：羽化雾底 x 揭示遮罩
            var combineShader = Shader.Find("DiceTale/FogCombine");
            if (combineShader == null)
            {
                Debug.LogError("[FogOfWar] Shader 'DiceTale/FogCombine' not found!");
                return;
            }

            combineMaterial = new Material(combineShader);
            combineMaterial.SetTexture("_MaskTex", maskTexture);

            var go = new GameObject("FogOverlay");
            go.transform.SetParent(transform, false);
            go.transform.localPosition = Vector3.zero;
            go.transform.localScale = new Vector3(gridWidth, gridHeight, 1f);

            var meshFilter = go.AddComponent<MeshFilter>();
            meshFilter.mesh = Resources.GetBuiltinResource<Mesh>("Quad.fbx");

            var meshRenderer = go.AddComponent<MeshRenderer>();
            meshRenderer.material = combineMaterial;
            meshRenderer.sortingOrder = fogSortingOrder;

            Debug.Log("[FogOfWar] fog overlay created (base + mask, GPU)");
        }

        /// <summary>检查玩家所在格子：进入某个雾区域则遮罩整块切除该区域。</summary>
        private void CheckPlayerFogArea()
        {
            if (gridMap == null || maskTexture == null)
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

            if (cellsByType.TryGetValue(type, out var indices))
            {
                for (int i = 0; i < indices.Count; i++)
                {
                    ClearMaskPixel(indices[i]);
                }

                maskTexture.Apply();
                Debug.Log($"[FogOfWar] area {type} revealed (cleared) by player at {gridPos}, remaining areas intact");
            }
        }

        /// <summary>按住鼠标右键，逐格擦除鼠标所指的雾（输入统一走 InputManager）。</summary>
        private void HandleRightClickErase()
        {
            if (gridMap == null || maskTexture == null)
            {
                return;
            }

            var input = Object.FindFirstObjectByType<InputManager>();
            if (input == null || !input.IsRightMouseHeld)
            {
                return;
            }

            var gridPos = gridMap.WorldToGrid(input.GetMouseWorldPosition());

            if (!IsFogType(gridMap.GetCellType(gridPos)))
            {
                return;
            }

            var index = gridPos.y * width + gridPos.x;
            if (index < 0 || index >= width * height)
            {
                return;
            }

            ClearMaskPixel(index);
            maskTexture.Apply();
        }

        private void ClearMaskPixel(int index)
        {
            var x = index % width;
            var y = index / width;
            maskTexture.SetPixel(x, y, new Color(1f, 1f, 1f, 0f));
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
