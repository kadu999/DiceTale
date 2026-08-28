using System.Collections.Generic;
using UnityEngine;

namespace DiceTale
{
    /// <summary>
    /// 迷雾区域（探索揭示，GPU 渲染，单层）：
    /// 所有雾标记（Fog1~Fog5）合成一块整体雾，边缘统一 GPU 羽化（有雾就光滑）。
    /// 玩家进入某个区域 → 该区域格子清除，剩余雾自动重新羽化，边缘保持光滑。
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

        [Tooltip("雾边缘羽化强度（GPU 模糊次数）")]
        [SerializeField]
        private int blurPasses = 2;

        /// <summary>所有雾位掩码（Fog1|Fog2|Fog3|Fog4|Fog5），用于提取格子的雾分量。</summary>
        private const GridCellType FogMask =
            GridCellType.Fog1 | GridCellType.Fog2 | GridCellType.Fog3 | GridCellType.Fog4 | GridCellType.Fog5;

        private const string BlurShaderName = "DiceTale/FogBlur";
        private const string GridSizeProperty = "_GridSize";

        private GridMap gridMap;

        // 单层雾状态（格子级）：alpha=1 雾存在，0 已揭示/擦除
        private Texture2D fogState;
        private int width;
        private int height;

        // GPU 羽化链
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
            HandleRightClickErase();
            TickPlayerReveal();
        }

        private void OnDestroy()
        {
            if (fogState != null)
            {
                Destroy(fogState);
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

        // ---------------------------------------------------------------- 构建

        private void BuildFog()
        {
            if (!TryInitGrid(out var gridWidth, out var gridHeight))
            {
                return;
            }

            if (!CreateBlurMaterial())
            {
                return;
            }

            CreateFogState();
            CreateBlurChain();
            CreateDisplayObject(gridWidth, gridHeight);
            BlurFog(); // 初始羽化一次

            Debug.Log($"[FogOfWar] {name}: fog cells={CountFogCells()}, single layer");
        }

        private bool TryInitGrid(out float gridWidth, out float gridHeight)
        {
            gridWidth = 0f;
            gridHeight = 0f;

            if (gridMap == null)
            {
                Debug.LogWarning("[FogOfWar] GridMap missing on " + name);
                return false;
            }

            var gridSize = gridMap.GridSize;
            if (gridSize.x <= 0 || gridSize.y <= 0 || gridMap.CellGrid == null)
            {
                Debug.LogWarning("[FogOfWar] Grid data not ready on " + name);
                return false;
            }

            width = gridSize.x;
            height = gridSize.y;
            gridWidth = gridMap.GridWidth;
            gridHeight = gridMap.GridHeight;
            return true;
        }

        private bool CreateBlurMaterial()
        {
            var blurShader = Shader.Find(BlurShaderName);
            if (blurShader == null)
            {
                Debug.LogError($"[FogOfWar] Shader '{BlurShaderName}' not found!");
                return false;
            }

            blurMaterial = new Material(blurShader);
            blurMaterial.SetVector(GridSizeProperty, new Vector4(width, height, 0f, 0f));
            return true;
        }

        /// <summary>单层雾状态：所有雾标记格子 alpha=1，并记录每区域格子。</summary>
        private void CreateFogState()
        {
            fogState = new Texture2D(width, height, TextureFormat.RGBA32, false);
            fogState.filterMode = FilterMode.Point;
            fogState.wrapMode = TextureWrapMode.Clamp;
            fogState.name = "FogState";

            var colors = new Color[width * height];
            cellsByType.Clear();

            var cellGrid = gridMap.CellGrid;
            for (int y = 0; y < height; y++)
            {
                for (int x = 0; x < width; x++)
                {
                    // 只取雾位分量：格子可能是 Obstacle|Fog1 等组合掩码，
                    // 分组/揭示一律按雾类型（Fog1~Fog5）归属，避免组合掩码把雾区拆散
                    var fogType = cellGrid[x, y] & FogMask;
                    if (fogType == GridCellType.Empty)
                    {
                        continue;
                    }

                    var index = y * width + x;
                    colors[index] = new Color(fogColor.r, fogColor.g, fogColor.b, 1f);

                    if (!cellsByType.TryGetValue(fogType, out var list))
                    {
                        list = new List<int>();
                        cellsByType[fogType] = list;
                    }

                    list.Add(index);
                }
            }

            fogState.SetPixels(colors);
            fogState.Apply();
        }

        private int CountFogCells()
        {
            var count = 0;
            foreach (var list in cellsByType.Values)
            {
                count += list.Count;
            }

            return count;
        }

        private void CreateBlurChain()
        {
            blurRTs = new RenderTexture[Mathf.Max(1, blurPasses)];
            for (int i = 0; i < blurRTs.Length; i++)
            {
                blurRTs[i] = new RenderTexture(width * 2, height * 2, 0, RenderTextureFormat.ARGB32);
                blurRTs[i].filterMode = FilterMode.Bilinear;
                blurRTs[i].wrapMode = TextureWrapMode.Clamp;
            }
        }

        private void CreateDisplayObject(float gridWidth, float gridHeight)
        {
            //displayMaterial = new Material(Shader.Find("Sprites/Default"));
            displayMaterial = new Material(Shader.Find("Unlit/Transparent"));

            var go = new GameObject("FogOverlay");
            go.transform.SetParent(transform, false);
            go.transform.localPosition = Vector3.zero;
            go.transform.localScale = new Vector3(gridWidth, gridHeight, 1f);

            var meshFilter = go.AddComponent<MeshFilter>();
            meshFilter.mesh = Resources.GetBuiltinResource<Mesh>("Quad.fbx");

            var meshRenderer = go.AddComponent<MeshRenderer>();
            meshRenderer.material = displayMaterial;
            meshRenderer.sortingOrder = fogSortingOrder;
        }

        // ---------------------------------------------------------------- 每帧渲染

        /// <summary>单层雾 GPU 羽化（每帧从状态重算，剩余雾边缘始终光滑）。</summary>
        private void BlurFog()
        {
            if (fogState == null || blurRTs == null || blurRTs.Length == 0 || blurMaterial == null)
            {
                return;
            }

            Graphics.Blit(fogState, blurRTs[0], blurMaterial);
            for (int i = 1; i < blurRTs.Length; i++)
            {
                Graphics.Blit(blurRTs[i - 1], blurRTs[i], blurMaterial);
            }

            displayMaterial.mainTexture = blurRTs[blurRTs.Length - 1];
        }

        // ---------------------------------------------------------------- 玩家揭示

        private void TickPlayerReveal()
        {
            checkTimer -= Time.deltaTime;
            if (checkTimer > 0f)
            {
                return;
            }

            checkTimer = checkInterval;
            CheckPlayerFogArea();
        }

        private void CheckPlayerFogArea()
        {
            var type = GetPlayerGridType();
            if (type == GridCellType.Empty || revealedAreas.Contains(type))
            {
                return;
            }

            revealedAreas.Add(type);
            ClearAreaCells(type);
            Debug.Log($"[FogOfWar] area {type} revealed (cleared)");
        }

        private GridCellType GetPlayerGridType()
        {
            if (gridMap == null)
            {
                return GridCellType.Empty;
            }

            var player = CharacterManager.Instance != null ? CharacterManager.Instance.CurrentPlayer : null;
            if (player == null)
            {
                return GridCellType.Empty;
            }

            var gridPos = gridMap.WorldToGrid(player.transform.position);
            // 只取雾位：与 cellsByType 的分组口径一致（Obstacle|Fog1 的格子按 Fog1 归属）
            return gridMap.GetCellType(gridPos) & FogMask;
        }

        // ---------------------------------------------------------------- 右键擦除

        private void HandleRightClickErase()
        {
            if (!allowRightClickErase || gridMap == null || fogState == null)
            {
                return;
            }

            var input = Object.FindFirstObjectByType<InputManager>();
            if (input == null || !input.IsRightMouseHeld)
            {
                return;
            }

            var gridPos = gridMap.WorldToGrid(input.GetMouseWorldPosition());
            var index = gridPos.y * width + gridPos.x;
            if (index < 0 || index >= width * height)
            {
                return;
            }

            ClearCell(index);
            BlurFog(); // 状态变化后重新羽化一次
        }

        // ---------------------------------------------------------------- 格子操作

        /// <summary>清除某区域的所有雾格子（批量写入，只上传一次 GPU）。</summary>
        private void ClearAreaCells(GridCellType type)
        {
            if (!cellsByType.TryGetValue(type, out var indices))
            {
                return;
            }

            var cleared = new Color(fogColor.r, fogColor.g, fogColor.b, 0f);
            for (int i = 0; i < indices.Count; i++)
            {
                fogState.SetPixel(indices[i] % width, indices[i] / width, cleared);
            }

            fogState.Apply(); // 只上传一次

            BlurFog(); // 状态变化后重新羽化一次
        }

        private void ClearCell(int index)
        {
            var color = fogState.GetPixel(index % width, index / width);
            if (color.a <= 0f)
            {
                return;
            }

            fogState.SetPixel(index % width, index / width, new Color(color.r, color.g, color.b, 0f));
            fogState.Apply();
        }
    }
}
