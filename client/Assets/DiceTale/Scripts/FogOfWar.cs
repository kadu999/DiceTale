using System.Collections.Generic;
using UnityEngine;

namespace DiceTale
{
    /// <summary>
    /// 迷雾区域（探索揭示，GPU 渲染）：
    /// 所有雾标记（Fog1~Fog5）合成一块整体雾，边缘羽化在 GPU 上通过模糊 shader 完成；
    /// 揭示按区域分开——玩家进入某个区域，只挖掉该区域的雾，其他区域保持遮挡。
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

        // 雾状态（CPU 维护的格子级纹理，alpha：1=雾存在 0=已揭示）
        private Texture2D stateTexture;
        private int width;
        private int height;

        // GPU 羽化结果（ping-pong 多次模糊）
        private RenderTexture[] blurRTs;
        private Material blurMaterial;
        private Material displayMaterial;

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

            // GPU 羽化：状态纹理经过多次模糊（ping-pong），边缘更柔和
            if (stateTexture != null && blurRTs != null && blurRTs.Length > 0 && blurMaterial != null)
            {
                Graphics.Blit(stateTexture, blurRTs[0], blurMaterial);
                for (int i = 1; i < blurRTs.Length; i++)
                {
                    Graphics.Blit(blurRTs[i - 1], blurRTs[i], blurMaterial);
                }

                displayMaterial.mainTexture = blurRTs[blurRTs.Length - 1];
            }
        }

        private void OnDestroy()
        {
            if (stateTexture != null)
            {
                Destroy(stateTexture);
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

        /// <summary>生成整体雾状态 + GPU 模糊链 + 显示层。</summary>
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

            // 1. 雾状态纹理（格子级）：雾格子 alpha=1，其余透明
            stateTexture = new Texture2D(width, height, TextureFormat.RGBA32, false);
            stateTexture.filterMode = FilterMode.Point;
            stateTexture.wrapMode = TextureWrapMode.Clamp;
            stateTexture.name = "FogState";

            var colors = new Color[width * height];
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
                    colors[index] = new Color(fogColor.r, fogColor.g, fogColor.b, 1f);
                    fogCells++;

                    if (!cellsByType.TryGetValue(type, out var list))
                    {
                        list = new List<int>();
                        cellsByType[type] = list;
                    }

                    list.Add(index);
                }
            }

            stateTexture.SetPixels(colors);
            stateTexture.Apply();

            Debug.Log($"[FogOfWar] {name}: fog cells={fogCells}, grid={width}x{height}");

            if (fogCells == 0)
            {
                return;
            }

            // 2. GPU 羽化链：状态纹理 -> 多次模糊 RT（ping-pong）
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

            // 3. 显示层：quad + 采样模糊 RT
            displayMaterial = new Material(Shader.Find("Sprites/Default"));
            displayMaterial.mainTexture = blurRTs[blurRTs.Length - 1];

            var go = new GameObject("FogOverlay");
            go.transform.SetParent(transform, false);
            go.transform.localPosition = Vector3.zero;
            go.transform.localScale = new Vector3(gridWidth, gridHeight, 1f);

            var meshFilter = go.AddComponent<MeshFilter>();
            meshFilter.mesh = Resources.GetBuiltinResource<Mesh>("Quad.fbx");

            var meshRenderer = go.AddComponent<MeshRenderer>();
            meshRenderer.material = displayMaterial;
            meshRenderer.sortingOrder = fogSortingOrder;

            Debug.Log("[FogOfWar] fog overlay created (GPU blur)");
        }

        /// <summary>检查玩家所在格子：进入某个雾区域则只挖掉该区域的雾。</summary>
        private void CheckPlayerFogArea()
        {
            if (gridMap == null || stateTexture == null)
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
                    ClearStatePixel(indices[i]);
                }

                stateTexture.Apply();
                Debug.Log($"[FogOfWar] area {type} revealed (cleared) by player at {gridPos}, remaining areas intact");
            }
        }

        /// <summary>按住鼠标右键，逐格擦除鼠标所指的雾（输入统一走 InputManager）。</summary>
        private void HandleRightClickErase()
        {
            if (gridMap == null || stateTexture == null)
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

            ClearStatePixel(index);
            stateTexture.Apply();
        }

        private void ClearStatePixel(int index)
        {
            var x = index % width;
            var y = index / width;
            stateTexture.SetPixel(x, y, new Color(fogColor.r, fogColor.g, fogColor.b, 0f));
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
