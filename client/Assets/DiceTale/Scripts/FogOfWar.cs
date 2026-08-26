using System.Collections.Generic;
using UnityEngine;

namespace DiceTale
{
    /// <summary>
    /// 迷雾区域（探索揭示，GPU 渲染）：
    /// 每个雾区域（Fog1~Fog5）有独立的雾底（外轮廓羽化）、独立遮罩、独立显示层。
    /// 玩家进入某个区域 → 该区域（含羽化边缘）整体干净消失，其他区域完全不受影响。
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

        private static readonly GridCellType[] FogTypes =
        {
            GridCellType.Fog1, GridCellType.Fog2, GridCellType.Fog3,
            GridCellType.Fog4, GridCellType.Fog5,
        };

        /// <summary>一个雾区域的渲染层：雾底 + 遮罩 + 模糊链 + 合成材质。</summary>
        private class FogAreaLayer
        {
            public GridCellType type;
            public Texture2D baseTex;
            public Texture2D maskTex;
            public RenderTexture[] blurRTs;
            public Material combineMat;
        }

        private GridMap gridMap;
        private readonly List<FogAreaLayer> layers = new List<FogAreaLayer>();
        private readonly Dictionary<GridCellType, FogAreaLayer> layerByType = new Dictionary<GridCellType, FogAreaLayer>();
        private readonly Dictionary<GridCellType, List<int>> cellsByType = new Dictionary<GridCellType, List<int>>();
        private readonly HashSet<GridCellType> revealedAreas = new HashSet<GridCellType>();
        private int width;
        private int height;
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

            // 每区域：GPU 羽化雾底
            for (int i = 0; i < layers.Count; i++)
            {
                var layer = layers[i];
                if (layer.blurRTs == null || layer.blurRTs.Length == 0 || layer.combineMat == null)
                {
                    continue;
                }

                Graphics.Blit(layer.baseTex, layer.blurRTs[0], blurMaterial);
                for (int j = 1; j < layer.blurRTs.Length; j++)
                {
                    Graphics.Blit(layer.blurRTs[j - 1], layer.blurRTs[j], blurMaterial);
                }

                layer.combineMat.SetTexture("_FogTex", layer.blurRTs[layer.blurRTs.Length - 1]);
            }
        }

        private Material blurMaterial;

        private void OnDestroy()
        {
            for (int i = 0; i < layers.Count; i++)
            {
                var layer = layers[i];
                if (layer.baseTex != null)
                {
                    Destroy(layer.baseTex);
                }

                if (layer.maskTex != null)
                {
                    Destroy(layer.maskTex);
                }

                if (layer.blurRTs != null)
                {
                    for (int j = 0; j < layer.blurRTs.Length; j++)
                    {
                        if (layer.blurRTs[j] != null)
                        {
                            layer.blurRTs[j].Release();
                            Destroy(layer.blurRTs[j]);
                        }
                    }
                }
            }
            layers.Clear();
        }

        /// <summary>为每个雾区域生成独立雾底 + 遮罩 + GPU 模糊链 + 显示层。</summary>
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

            var blurShader = Shader.Find("DiceTale/FogBlur");
            var combineShader = Shader.Find("DiceTale/FogCombine");
            if (blurShader == null || combineShader == null)
            {
                Debug.LogError("[FogOfWar] Shaders 'DiceTale/FogBlur'/'DiceTale/FogCombine' not found!");
                return;
            }

            blurMaterial = new Material(blurShader);
            blurMaterial.SetVector("_GridSize", new Vector4(width, height, 0f, 0f));

            cellsByType.Clear();

            // 收集每个区域的格子
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
                    if (!cellsByType.TryGetValue(type, out var list))
                    {
                        list = new List<int>();
                        cellsByType[type] = list;
                    }

                    list.Add(index);
                }
            }

            foreach (var fogType in FogTypes)
            {
                if (!cellsByType.TryGetValue(fogType, out var indices) || indices.Count == 0)
                {
                    continue;
                }

                var layer = new FogAreaLayer { type = fogType };

                // 雾底：该区域格子 alpha=1
                layer.baseTex = new Texture2D(width, height, TextureFormat.RGBA32, false);
                layer.baseTex.filterMode = FilterMode.Point;
                layer.baseTex.wrapMode = TextureWrapMode.Clamp;
                layer.baseTex.name = "FogBase_" + fogType;

                var baseColors = new Color[width * height];
                for (int i = 0; i < indices.Count; i++)
                {
                    baseColors[indices[i]] = new Color(fogColor.r, fogColor.g, fogColor.b, 1f);
                }

                layer.baseTex.SetPixels(baseColors);
                layer.baseTex.Apply();

                // 遮罩：初始全部未揭示（alpha=1）
                layer.maskTex = new Texture2D(width, height, TextureFormat.RGBA32, false);
                layer.maskTex.filterMode = FilterMode.Point;
                layer.maskTex.wrapMode = TextureWrapMode.Clamp;
                layer.maskTex.name = "Mask_" + fogType;

                var maskColors = new Color[width * height];
                for (int i = 0; i < maskColors.Length; i++)
                {
                    maskColors[i] = new Color(1f, 1f, 1f, 1f);
                }

                layer.maskTex.SetPixels(maskColors);
                layer.maskTex.Apply();

                // GPU 模糊链
                layer.blurRTs = new RenderTexture[Mathf.Max(1, blurPasses)];
                for (int i = 0; i < layer.blurRTs.Length; i++)
                {
                    layer.blurRTs[i] = new RenderTexture(width * 2, height * 2, 0, RenderTextureFormat.ARGB32);
                    layer.blurRTs[i].filterMode = FilterMode.Bilinear;
                    layer.blurRTs[i].wrapMode = TextureWrapMode.Clamp;
                }

                // 合成材质：雾底 x 遮罩
                layer.combineMat = new Material(combineShader);
                layer.combineMat.SetTexture("_MaskTex", layer.maskTex);

                // 显示层（每个区域一个 quad，叠加显示）
                var go = new GameObject("FogArea_" + fogType);
                go.transform.SetParent(transform, false);
                go.transform.localPosition = Vector3.zero;
                go.transform.localScale = new Vector3(gridWidth, gridHeight, 1f);

                var meshFilter = go.AddComponent<MeshFilter>();
                meshFilter.mesh = Resources.GetBuiltinResource<Mesh>("Quad.fbx");

                var meshRenderer = go.AddComponent<MeshRenderer>();
                meshRenderer.material = layer.combineMat;
                meshRenderer.sortingOrder = fogSortingOrder;

                layers.Add(layer);
                layerByType[fogType] = layer;
                Debug.Log($"[FogOfWar] area {fogType}: {indices.Count} cells, layer created");
            }

            Debug.Log($"[FogOfWar] {name}: {layers.Count} fog area layer(s) built");
        }

        /// <summary>检查玩家所在格子：进入某个雾区域则整块切除该区域（含羽化边缘）。</summary>
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

            if (layerByType.TryGetValue(type, out var layer))
            {
                ClearAreaMask(layer);
                Debug.Log($"[FogOfWar] area {type} revealed (cleared) by player at {gridPos}, other areas unaffected");
            }
        }

        /// <summary>按住鼠标右键，逐格擦除鼠标所指的雾（输入统一走 InputManager）。</summary>
        private void HandleRightClickErase()
        {
            if (gridMap == null)
            {
                return;
            }

            var input = Object.FindFirstObjectByType<InputManager>();
            if (input == null || !input.IsRightMouseHeld)
            {
                return;
            }

            var gridPos = gridMap.WorldToGrid(input.GetMouseWorldPosition());
            var type = gridMap.GetCellType(gridPos);

            if (!layerByType.TryGetValue(type, out var layer))
            {
                return;
            }

            var index = gridPos.y * width + gridPos.x;
            if (index < 0 || index >= width * height)
            {
                return;
            }

            layer.maskTex.SetPixel(index % width, index / width, new Color(1f, 1f, 1f, 0f));
            layer.maskTex.Apply();
        }

        /// <summary>把某区域的所有雾格子遮罩置 0（该区域整块消失）。</summary>
        private void ClearAreaMask(FogAreaLayer layer)
        {
            if (cellsByType.TryGetValue(layer.type, out var indices))
            {
                for (int i = 0; i < indices.Count; i++)
                {
                    layer.maskTex.SetPixel(indices[i] % width, indices[i] / width, new Color(1f, 1f, 1f, 0f));
                }

                layer.maskTex.Apply();
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
