using UnityEngine;

namespace DiceTale
{
    [RequireComponent(typeof(GridMap))]
    public class FogOfWar : MonoBehaviour
    {
        private const int MaxPlayers = 8;

        [SerializeField]
        private int revealRadius = 5;

        [SerializeField]
        private float softEdgeWidth = 2f;

        [SerializeField]
        private int maskResolution = 8;

        [SerializeField]
        private Color fogColor = new Color(0.85f, 0.88f, 0.9f, 0.75f);

        [SerializeField]
        private float updateInterval = 0.05f;

        [SerializeField]
        private int fogSortingOrder = 1;

        [SerializeField]
        private Shader displayShader;

        [SerializeField]
        private Shader accumulateShader;

        private GridMap gridMap;
        private MeshRenderer fogRenderer;
        private Material displayMaterial;
        private Material accumulateMaterial;
        private RenderTexture prevMask;
        private RenderTexture nextMask;
        private Vector4[] playerPositions = new Vector4[MaxPlayers];
        private float lastUpdateTime;

        private void Start()
        {
            gridMap = GetComponent<GridMap>();
            CreateFog();
        }

        private void OnDestroy()
        {
            ReleaseRenderTextures();
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

            ReleaseRenderTextures();

            var format = RenderTextureFormat.ARGB32;
            prevMask = new RenderTexture(maskSize.x, maskSize.y, 0, format);
            nextMask = new RenderTexture(maskSize.x, maskSize.y, 0, format);
            prevMask.filterMode = FilterMode.Bilinear;
            nextMask.filterMode = FilterMode.Bilinear;
            prevMask.wrapMode = TextureWrapMode.Clamp;
            nextMask.wrapMode = TextureWrapMode.Clamp;
            prevMask.Create();
            nextMask.Create();

            RenderTexture.active = prevMask;
            GL.Clear(true, true, Color.black);
            RenderTexture.active = null;

            var displayShaderInstance = displayShader != null ? displayShader : Shader.Find("DiceTale/FogOfWar");
            var accumulateShaderInstance = accumulateShader != null ? accumulateShader : Shader.Find("DiceTale/FogOfWarAccumulate");

            displayMaterial = new Material(displayShaderInstance);
            displayMaterial.SetColor("_FogColor", fogColor);

            accumulateMaterial = new Material(accumulateShaderInstance);
            accumulateMaterial.SetFloat("_RevealRadius", revealRadius * gridMap.CellSize);
            accumulateMaterial.SetFloat("_SoftEdgeWidth", softEdgeWidth * gridMap.CellSize);
            accumulateMaterial.SetFloat("_CellSize", gridMap.CellSize);
            accumulateMaterial.SetVector("_GridOrigin", gridMap.GridOrigin);
            accumulateMaterial.SetVector("_GridSize", new Vector4(gridMap.GridSize.x, gridMap.GridSize.y, 0, 0));

            var go = new GameObject("FogOfWar");
            go.transform.SetParent(transform, false);
            //go.transform.position = gridMap.GridOrigin;
            go.transform.localPosition = Vector3.zero;
            go.transform.localScale = new Vector3(
                gridMap.GridSize.x * gridMap.CellSize,
                gridMap.GridSize.y * gridMap.CellSize,
                1f
            );

            var meshFilter = go.AddComponent<MeshFilter>();
            meshFilter.mesh = Resources.GetBuiltinResource<Mesh>("Quad.fbx");

            fogRenderer = go.AddComponent<MeshRenderer>();
            fogRenderer.material = displayMaterial;
            fogRenderer.sortingOrder = fogSortingOrder;

            displayMaterial.SetTexture("_FogMask", nextMask);
        }

        private void UpdateFog()
        {
            var characterManager = CharacterManager.Instance;
            int playerCount = 0;

            if (characterManager != null)
            {
                foreach (var player in characterManager.Players)
                {
                    if (player == null || playerCount >= MaxPlayers)
                    {
                        continue;
                    }

                    var pos = player.transform.position;
                    playerPositions[playerCount] = new Vector4(pos.x, pos.y, 0, 0);
                    playerCount++;
                }
            }

            accumulateMaterial.SetInt("_PlayerCount", playerCount);
            accumulateMaterial.SetVectorArray("_PlayerPositions", playerPositions);

            Graphics.Blit(prevMask, nextMask, accumulateMaterial);

            displayMaterial.SetTexture("_FogMask", nextMask);

            var temp = prevMask;
            prevMask = nextMask;
            nextMask = temp;
        }

        private void ReleaseRenderTextures()
        {
            if (prevMask != null)
            {
                prevMask.Release();
                Destroy(prevMask);
                prevMask = null;
            }

            if (nextMask != null)
            {
                nextMask.Release();
                Destroy(nextMask);
                nextMask = null;
            }
        }
    }
}
