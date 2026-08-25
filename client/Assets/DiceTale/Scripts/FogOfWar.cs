using System.Collections.Generic;
using UnityEngine;

namespace DiceTale
{
    [RequireComponent(typeof(GridMap))]
    public class FogOfWar : MonoBehaviour
    {
        [SerializeField]
        private int revealRadius = 5;

        [SerializeField]
        [Range(0f, 1f)]
        private float fadeStart = 0f;

        [SerializeField]
        private int maskResolution = 8;

        [SerializeField]
        private Color fogColor = new Color(0.85f, 0.88f, 0.9f, 0.9f);

        [SerializeField]
        private Color exploredColor = new Color(0.7f, 0.75f, 0.8f, 0.6f);

        [SerializeField]
        private float updateInterval = 0.05f;

        [SerializeField]
        private int fogSortingOrder = 1;

        [SerializeField]
        private Shader fogShader;

        private GridMap gridMap;
        private Texture2D fogMaskTexture;
        private SpriteRenderer fogRenderer;
        private Color[] maskPixels;
        private float[] visibility;
        private float lastUpdateTime;

        private void Start()
        {
            gridMap = GetComponent<GridMap>();
            CreateFog();
        }

        private void Update()
        {
            if (Time.time - lastUpdateTime < updateInterval)
            {
                return;
            }

            lastUpdateTime = Time.time;
            UpdateFog();
        }

        private void CreateFog()
        {
            var maskSize = new Vector2Int(
                gridMap.GridSize.x * maskResolution,
                gridMap.GridSize.y * maskResolution
            );

            fogMaskTexture = new Texture2D(maskSize.x, maskSize.y, TextureFormat.RGBA32, false);
            fogMaskTexture.filterMode = FilterMode.Bilinear;
            fogMaskTexture.wrapMode = TextureWrapMode.Clamp;

            maskPixels = new Color[maskSize.x * maskSize.y];
            visibility = new float[maskSize.x * maskSize.y];

            for (int i = 0; i < maskPixels.Length; i++)
            {
                maskPixels[i] = Color.black;
            }

            fogMaskTexture.SetPixels(maskPixels);
            fogMaskTexture.Apply();

            var sprite = Sprite.Create(
                fogMaskTexture,
                new Rect(0, 0, maskSize.x, maskSize.y),
                Vector2.zero,
                maskResolution / gridMap.CellSize
            );

            var go = new GameObject("FogOfWar");
            go.transform.SetParent(transform, false);
            go.transform.position = gridMap.GridOrigin;

            fogRenderer = go.AddComponent<SpriteRenderer>();
            fogRenderer.sprite = sprite;
            fogRenderer.sortingOrder = fogSortingOrder;

            var material = new Material(fogShader != null ? fogShader : Shader.Find("DiceTale/FogOfWar"));
            material.SetTexture("_FogMask", fogMaskTexture);
            material.SetColor("_FogColor", fogColor);
            material.SetColor("_ExploredColor", exploredColor);
            fogRenderer.material = material;
        }

        private void UpdateFog()
        {
            var maskSize = new Vector2Int(
                gridMap.GridSize.x * maskResolution,
                gridMap.GridSize.y * maskResolution
            );

            for (int i = 0; i < visibility.Length; i++)
            {
                visibility[i] = 0f;
            }

            var characterManager = CharacterManager.Instance;
            if (characterManager != null)
            {
                foreach (var player in characterManager.Players)
                {
                    if (player == null)
                    {
                        continue;
                    }

                    RevealAround(player.transform.position, maskSize);
                }
            }

            for (int i = 0; i < maskPixels.Length; i++)
            {
                float v = visibility[i];
                if (v > 0f)
                {
                    maskPixels[i].r = v;
                    maskPixels[i].g = v;
                    maskPixels[i].b = v;
                }
                else if (maskPixels[i].r > 0f)
                {
                    maskPixels[i].r = exploredColor.a;
                    maskPixels[i].g = exploredColor.a;
                    maskPixels[i].b = exploredColor.a;
                }
                else
                {
                    maskPixels[i] = Color.black;
                }
            }

            fogMaskTexture.SetPixels(maskPixels);
            fogMaskTexture.Apply();
        }

        private void RevealAround(Vector3 worldPosition, Vector2Int maskSize)
        {
            var gridPos = gridMap.WorldToGrid(worldPosition);
            var centerX = (gridPos.x + 0.5f) * maskResolution;
            var centerY = (gridPos.y + 0.5f) * maskResolution;
            var radiusPixels = revealRadius * maskResolution;
            var radiusSq = radiusPixels * radiusPixels;

            var minX = Mathf.Max(0, Mathf.FloorToInt(centerX - radiusPixels));
            var maxX = Mathf.Min(maskSize.x - 1, Mathf.CeilToInt(centerX + radiusPixels));
            var minY = Mathf.Max(0, Mathf.FloorToInt(centerY - radiusPixels));
            var maxY = Mathf.Min(maskSize.y - 1, Mathf.CeilToInt(centerY + radiusPixels));

            for (int y = minY; y <= maxY; y++)
            {
                for (int x = minX; x <= maxX; x++)
                {
                    var dx = x - centerX;
                    var dy = y - centerY;
                    var distSq = dx * dx + dy * dy;
                    if (distSq > radiusSq)
                    {
                        continue;
                    }

                    var normalizedDist = Mathf.Sqrt(distSq) / radiusPixels;
                    var value = 1f - Mathf.SmoothStep(fadeStart, 1f, normalizedDist);

                    var index = y * maskSize.x + x;
                    if (value > visibility[index])
                    {
                        visibility[index] = value;
                    }
                }
            }
        }
    }
}
