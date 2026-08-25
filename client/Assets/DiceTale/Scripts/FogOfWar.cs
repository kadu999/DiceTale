using System.Collections.Generic;
using UnityEngine;

namespace DiceTale
{
    [RequireComponent(typeof(GridMap))]
    public class FogOfWar : MonoBehaviour
    {
        [SerializeField]
        private int revealRadius = 3;

        [SerializeField]
        private Color fogColor = Color.black;

        [SerializeField]
        private Color exploredColor = new Color(0f, 0f, 0f, 0.7f);

        [SerializeField]
        private float updateInterval = 0.1f;

        [SerializeField]
        private int fogSortingOrder = 1;

        private GridMap gridMap;
        private Texture2D fogTexture;
        private SpriteRenderer fogRenderer;
        private Color[] pixels;
        private bool[] visited;
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
            var size = gridMap.GridSize;
            fogTexture = new Texture2D(size.x, size.y, TextureFormat.RGBA32, false);
            fogTexture.filterMode = FilterMode.Point;
            fogTexture.wrapMode = TextureWrapMode.Clamp;

            pixels = new Color[size.x * size.y];
            visited = new bool[size.x * size.y];

            for (int i = 0; i < pixels.Length; i++)
            {
                pixels[i] = fogColor;
            }

            fogTexture.SetPixels(pixels);
            fogTexture.Apply();

            var sprite = Sprite.Create(
                fogTexture,
                new Rect(0, 0, size.x, size.y),
                new Vector2(0.5f, 0.5f),
                1f / gridMap.CellSize
            );

            fogRenderer = gameObject.AddComponent<SpriteRenderer>();
            fogRenderer.sprite = sprite;
            fogRenderer.sortingOrder = fogSortingOrder;
        }

        private void UpdateFog()
        {
            var size = gridMap.GridSize;
            var visible = new HashSet<int>();

            var characterManager = CharacterManager.Instance;
            if (characterManager != null)
            {
                foreach (var player in characterManager.Players)
                {
                    if (player == null)
                    {
                        continue;
                    }

                    RevealAround(gridMap.WorldToGrid(player.transform.position), visible);
                }
            }

            for (int i = 0; i < pixels.Length; i++)
            {
                if (visible.Contains(i))
                {
                    pixels[i] = Color.clear;
                    visited[i] = true;
                }
                else if (visited[i])
                {
                    pixels[i] = exploredColor;
                }
                else
                {
                    pixels[i] = fogColor;
                }
            }

            fogTexture.SetPixels(pixels);
            fogTexture.Apply();
        }

        private void RevealAround(Vector2Int center, HashSet<int> visible)
        {
            var size = gridMap.GridSize;
            var radiusSq = revealRadius * revealRadius;

            for (int x = -revealRadius; x <= revealRadius; x++)
            {
                for (int y = -revealRadius; y <= revealRadius; y++)
                {
                    if (x * x + y * y > radiusSq)
                    {
                        continue;
                    }

                    var pos = new Vector2Int(center.x + x, center.y + y);
                    if (pos.x < 0 || pos.x >= size.x || pos.y < 0 || pos.y >= size.y)
                    {
                        continue;
                    }

                    visible.Add(pos.y * size.x + pos.x);
                }
            }
        }
    }
}
