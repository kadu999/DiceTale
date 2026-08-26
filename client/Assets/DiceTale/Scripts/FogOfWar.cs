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

        private const string BlurShaderName = "DiceTale/FogBlur";
        private const string CombineShaderName = "DiceTale/FogCombine";
        private const string FogTexProperty = "_FogTex";
        private const string MaskTexProperty = "_MaskTex";
        private const string GridSizeProperty = "_GridSize";

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
        private Material blurMaterial;
        private readonly List<FogAreaLayer> layers = new List<FogAreaLayer>();
        private readonly Dictionary<GridCellType, FogAreaLayer> layerByType = new Dictionary<GridCellType, FogAreaLayer>();
        private readonly Dictionary<GridCellType, List<int>> cellsByType = new Dictionary<GridCellType, List<int>>();
        private readonly HashSet<GridCellType> revealedAreas = new HashSet<GridCellType>();
        private int width;
        private int height;
        private float checkTimer;

        // ---------------------------------------------------------------- 生命周期

        private void Start()
        {
            gridMap = GetComponent<GridMap>();
            BuildFog();
        }

        private void Update()
        {
            HandleRightClickErase();
            TickPlayerReveal();
            BlurAllLayers();
        }

        private void OnDestroy()
        {
            for (int i = 0; i < layers.Count; i++)
            {
                DestroyLayer(layers[i]);
            }

            layers.Clear();
            layerByType.Clear();
            cellsByType.Clear();
        }

        // ---------------------------------------------------------------- 构建

        /// <summary>初始化所有雾区域层。</summary>
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

            CollectFogCells();
            CreateAllLayers(gridWidth, gridHeight);
            Debug.Log($"[FogOfWar] {name}: {layers.Count} fog area layer(s) built");
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
            var combineShader = Shader.Find(CombineShaderName);
            if (blurShader == null || combineShader == null)
            {
                Debug.LogError($"[FogOfWar] Shaders '{BlurShaderName}'/'{CombineShaderName}' not found!");
                return false;
            }

            blurMaterial = new Material(blurShader);
            blurMaterial.SetVector(GridSizeProperty, new Vector4(width, height, 0f, 0f));
            return true;
        }

        /// <summary>遍历网格，按雾类型收集格子索引。</summary>
        private void CollectFogCells()
        {
            cellsByType.Clear();

            var cellGrid = gridMap.CellGrid;
            for (int y = 0; y < height; y++)
            {
                for (int x = 0; x < width; x++)
                {
                    var type = cellGrid[x, y];
                    if (!IsFogType(type))
                    {
                        continue;
                    }

                    AddCellToGroup(type, y * width + x);
                }
            }
        }

        private void AddCellToGroup(GridCellType type, int index)
        {
            if (!cellsByType.TryGetValue(type, out var list))
            {
                list = new List<int>();
                cellsByType[type] = list;
            }

            list.Add(index);
        }

        private void CreateAllLayers(float gridWidth, float gridHeight)
        {
            for (int i = 0; i < FogTypes.Length; i++)
            {
                var fogType = FogTypes[i];
                if (!cellsByType.TryGetValue(fogType, out var indices) || indices.Count == 0)
                {
                    continue;
                }

                CreateAreaLayer(fogType, indices, gridWidth, gridHeight);
            }
        }

        private void CreateAreaLayer(GridCellType fogType, List<int> indices, float gridWidth, float gridHeight)
        {
            var layer = new FogAreaLayer { type = fogType };

            CreateBaseTexture(layer, indices);
            CreateMaskTexture(layer);
            CreateBlurChain(layer);
            CreateDisplayObject(layer, gridWidth, gridHeight);
            RegisterLayer(layer);

            Debug.Log($"[FogOfWar] area {fogType}: {indices.Count} cells, layer created");
        }

        private void CreateBaseTexture(FogAreaLayer layer, List<int> indices)
        {
            layer.baseTex = CreateGridTexture("FogBase_" + layer.type);
            var colors = new Color[width * height];

            for (int i = 0; i < indices.Count; i++)
            {
                colors[indices[i]] = new Color(fogColor.r, fogColor.g, fogColor.b, 1f);
            }

            layer.baseTex.SetPixels(colors);
            layer.baseTex.Apply();
        }

        private void CreateMaskTexture(FogAreaLayer layer)
        {
            layer.maskTex = CreateGridTexture("Mask_" + layer.type);

            // 初始全部未揭示（alpha=1）
            var colors = new Color[width * height];
            for (int i = 0; i < colors.Length; i++)
            {
                colors[i] = new Color(1f, 1f, 1f, 1f);
            }

            layer.maskTex.SetPixels(colors);
            layer.maskTex.Apply();
        }

        private Texture2D CreateGridTexture(string name)
        {
            var texture = new Texture2D(width, height, TextureFormat.RGBA32, false);
            texture.filterMode = FilterMode.Point;
            texture.wrapMode = TextureWrapMode.Clamp;
            texture.name = name;
            return texture;
        }

        private void CreateBlurChain(FogAreaLayer layer)
        {
            layer.blurRTs = new RenderTexture[Mathf.Max(1, blurPasses)];
            for (int i = 0; i < layer.blurRTs.Length; i++)
            {
                layer.blurRTs[i] = new RenderTexture(width * 2, height * 2, 0, RenderTextureFormat.ARGB32);
                layer.blurRTs[i].filterMode = FilterMode.Bilinear;
                layer.blurRTs[i].wrapMode = TextureWrapMode.Clamp;
            }
        }

        private void CreateDisplayObject(FogAreaLayer layer, float gridWidth, float gridHeight)
        {
            var combineShader = Shader.Find(CombineShaderName);
            layer.combineMat = new Material(combineShader);
            layer.combineMat.SetTexture(MaskTexProperty, layer.maskTex);

            var go = new GameObject("FogArea_" + layer.type);
            go.transform.SetParent(transform, false);
            go.transform.localPosition = Vector3.zero;
            go.transform.localScale = new Vector3(gridWidth, gridHeight, 1f);

            var meshFilter = go.AddComponent<MeshFilter>();
            meshFilter.mesh = Resources.GetBuiltinResource<Mesh>("Quad.fbx");

            var meshRenderer = go.AddComponent<MeshRenderer>();
            meshRenderer.material = layer.combineMat;
            meshRenderer.sortingOrder = fogSortingOrder;
        }

        private void RegisterLayer(FogAreaLayer layer)
        {
            layers.Add(layer);
            layerByType[layer.type] = layer;
        }

        private void DestroyLayer(FogAreaLayer layer)
        {
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

        // ---------------------------------------------------------------- 每帧渲染

        /// <summary>对所有雾区域做 GPU 羽化并更新合成纹理。</summary>
        private void BlurAllLayers()
        {
            if (blurMaterial == null)
            {
                return;
            }

            for (int i = 0; i < layers.Count; i++)
            {
                BlurLayer(layers[i]);
            }
        }

        private void BlurLayer(FogAreaLayer layer)
        {
            if (layer.blurRTs == null || layer.blurRTs.Length == 0 || layer.combineMat == null)
            {
                return;
            }

            Graphics.Blit(layer.baseTex, layer.blurRTs[0], blurMaterial);
            for (int i = 1; i < layer.blurRTs.Length; i++)
            {
                Graphics.Blit(layer.blurRTs[i - 1], layer.blurRTs[i], blurMaterial);
            }

            layer.combineMat.SetTexture(FogTexProperty, layer.blurRTs[layer.blurRTs.Length - 1]);
        }

        // ---------------------------------------------------------------- 玩家揭示

        /// <summary>节流检查玩家是否进入某个雾区域。</summary>
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

            RevealArea(type);
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
            return gridMap.GetCellType(gridPos);
        }

        /// <summary>整块切除某个雾区域（含羽化边缘），其他区域不受影响。</summary>
        private void RevealArea(GridCellType type)
        {
            revealedAreas.Add(type);

            if (!layerByType.TryGetValue(type, out var layer))
            {
                return;
            }

            ClearAreaMask(layer);
            Debug.Log($"[FogOfWar] area {type} revealed (cleared), other areas unaffected");
        }

        // ---------------------------------------------------------------- 右键擦除

        /// <summary>按住鼠标右键，逐格擦除鼠标所指的雾（输入统一走 InputManager）。</summary>
        private void HandleRightClickErase()
        {
            if (!allowRightClickErase || gridMap == null)
            {
                return;
            }

            if (!TryGetEraseTarget(out var layer, out var index))
            {
                return;
            }

            ClearMaskCell(layer, index);
            ApplyMask(layer);
        }

        private bool TryGetEraseTarget(out FogAreaLayer layer, out int index)
        {
            layer = null;
            index = -1;

            var input = Object.FindFirstObjectByType<InputManager>();
            if (input == null || !input.IsRightMouseHeld)
            {
                return false;
            }

            var gridPos = gridMap.WorldToGrid(input.GetMouseWorldPosition());
            var type = gridMap.GetCellType(gridPos);

            if (!layerByType.TryGetValue(type, out layer))
            {
                return false;
            }

            index = gridPos.y * width + gridPos.x;
            return index >= 0 && index < width * height;
        }

        // ---------------------------------------------------------------- 遮罩操作

        /// <summary>把某区域的所有雾格子遮罩置 0（该区域整块消失）。</summary>
        private void ClearAreaMask(FogAreaLayer layer)
        {
            if (!cellsByType.TryGetValue(layer.type, out var indices))
            {
                return;
            }

            for (int i = 0; i < indices.Count; i++)
            {
                ClearMaskCell(layer, indices[i]);
            }

            ApplyMask(layer);
        }

        private void ClearMaskCell(FogAreaLayer layer, int index)
        {
            layer.maskTex.SetPixel(index % width, index / width, new Color(1f, 1f, 1f, 0f));
        }

        private static void ApplyMask(FogAreaLayer layer)
        {
            layer.maskTex.Apply();
        }

        // ---------------------------------------------------------------- 工具

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
