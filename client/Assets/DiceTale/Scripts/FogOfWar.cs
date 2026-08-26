using System.Collections.Generic;
using UnityEngine;

namespace DiceTale
{
    /// <summary>
    /// 迷雾区域（探索揭示）：
    /// Fog1~Fog5 各代表一个雾区域。未探索的雾区域被不透明雾遮挡（看不到区域内容），
    /// 玩家进入某个雾区域后，该区域的雾散开、被揭示可见。
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

        /// <summary>为每个雾等级生成一个区域层，默认不透明遮挡，玩家进入后散开。</summary>
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

            // 一次遍历全图，按雾类型收集格子索引
            var cellsByType = new Dictionary<GridCellType, List<int>>();
            for (int y = 0; y < gridSize.y; y++)
            {
                for (int x = 0; x < gridSize.x; x++)
                {
                    var type = cellGrid[x, y];
                    if (!IsFogType(type))
                    {
                        continue;
                    }

                    if (!cellsByType.TryGetValue(type, out var list))
                    {
                        list = new List<int>();
                        cellsByType[type] = list;
                    }

                    list.Add(y * gridSize.x + x);
                }
            }

            foreach (var pair in cellsByType)
            {
                var fogType = pair.Key;
                var indices = pair.Value;

                var colors = new Color[gridSize.x * gridSize.y];
                for (int i = 0; i < indices.Count; i++)
                {
                    // 不透明雾（未揭示时完全遮挡）
                    colors[indices[i]] = new Color(fogColor.r, fogColor.g, fogColor.b, 1f);
                }

                var texture = new Texture2D(gridSize.x, gridSize.y, TextureFormat.RGBA32, false);
                texture.filterMode = FilterMode.Point;
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
                renderer.enabled = true; // 默认遮挡，玩家进入后散开

                fogAreas[fogType] = renderer;
                Debug.Log($"[FogOfWar] area {fogType}: {indices.Count} cells, blocking");
            }

            Debug.Log($"[FogOfWar] {name}: {fogAreas.Count} fog area(s) built");
        }

        /// <summary>检查玩家所在格子：进入某个雾区域则雾散开（揭示该区域）。</summary>
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
                renderer.enabled = false; // 雾散开，区域被揭示
                Debug.Log($"[FogOfWar] area {type} revealed (fog cleared) by player at {gridPos}");
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
