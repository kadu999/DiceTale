using UnityEngine;

namespace DiceTale
{
    /// <summary>
    /// 参考 BoxMaskEffect 的左右擦除（MaskImage）效果，不依赖 boxSprites：
    /// 遮罩是一条从左到右（或从右到左）推进的边界——覆盖侧显示效果纹理（纹理2），
    /// 未覆盖侧显示背景纹理（纹理1）；交界带（blendWidth）内两张纹理平滑交叉混合，不透明。
    /// 与 BoxMaskEffect 同款管线：WipeMask 一次 Graphics.Blit 把进度边界画进 maskRT，
    /// 然后在 CreateMaskRT 里 meshRenderer.material.SetTexture("_MaskTex", maskRT)。
    /// 输出 meshRenderer 的材质需用 DiceTale/BoxComposite，背景/效果纹理在材质上配好。
    /// </summary>
    public class WipeMaskEffect : MonoBehaviour
    {
        [Header("输出")]
        [Tooltip("合成结果输出到哪个 MeshRenderer（材质需用 DiceTale/BoxComposite，背景/效果纹理在材质上配）")]
        [SerializeField]
        private MeshRenderer meshRenderer;

        [Header("擦除")]
        [Tooltip("擦除进度 0~1：0 = 全背景，1 = 全效果（autoPlay 时由动画驱动）")]
        [SerializeField, Range(0f, 1f)]
        private float wipeProgress;

        [Tooltip("方向：勾选 = 从左到右，不勾选 = 从右到左")]
        [SerializeField]
        private bool leftToRight = true;

        [Tooltip("交界混合带宽（UV 单位，0 = 硬边；带宽内纹理1/纹理2 平滑交叉混合）")]
        [SerializeField, Range(0f, 0.5f)]
        private float blendWidth = 0.1f;

        [Tooltip("自动动画：进度从 0 播到 1")]
        [SerializeField]
        private bool autoPlay = true;

        [Tooltip("动画时长（秒）")]
        [SerializeField]
        private float duration = 1f;

        [Tooltip("循环播放（0→1→0→1...）")]
        [SerializeField]
        private bool loop = true;

        [Header("遮罩")]
        [Tooltip("遮罩分辨率（边界是平滑渐变，可以低一些）")]
        [SerializeField]
        private Vector2Int maskSize = new Vector2Int(512, 512);

        private Material wipeMaterial;
        private RenderTexture maskRT;

        private bool maskDirty = true;
        private float animTime;
        private float lastProgress = -1f;

        private static readonly int WipeProgressId = Shader.PropertyToID("_WipeProgress");
        private static readonly int DirectionId = Shader.PropertyToID("_Direction");
        private static readonly int BlendWidthId = Shader.PropertyToID("_BlendWidth");

        private const string WipeShaderName = "DiceTale/WipeMask";

        /// <summary>当前擦除进度（0~1）。</summary>
        public float WipeProgress => wipeProgress;

        private void Awake()
        {
            CreateMaterials();
            CreateMaskRT();
        }

        private void Update()
        {
            if (autoPlay)
            {
                animTime += Time.deltaTime;
                if (loop)
                {
                    animTime = Mathf.Repeat(animTime, Mathf.Max(0.001f, duration));
                }
                else
                {
                    animTime = Mathf.Min(animTime, duration);
                }

                wipeProgress = Mathf.Clamp01(animTime / Mathf.Max(0.001f, duration));
                maskDirty = true;
            }
            else if (Mathf.Abs(wipeProgress - lastProgress) > 1e-4f)
            {
                // 手动模式：进度变化（Inspector 滑条或 SetWipeProgress）时重建
                lastProgress = wipeProgress;
                maskDirty = true;
            }

            if (maskDirty)
            {
                RebuildMask();
            }
        }

        private void OnDestroy()
        {
            if (maskRT != null)
            {
                maskRT.Release();
            }

            if (wipeMaterial != null)
            {
                Destroy(wipeMaterial);
            }
        }

        // ---------------------------------------------------------------- 公开 API

        /// <summary>手动设置擦除进度（0~1）。建议在 autoPlay=false 时使用。</summary>
        public void SetWipeProgress(float value)
        {
            wipeProgress = Mathf.Clamp01(value);
            maskDirty = true;
        }

        /// <summary>设置方向：true = 从左到右，false = 从右到左。</summary>
        public void SetDirection(bool leftToRight)
        {
            if (this.leftToRight == leftToRight)
            {
                return;
            }

            this.leftToRight = leftToRight;
            maskDirty = true;
        }

        /// <summary>重置动画并从 0 重新播放（autoPlay 时生效）。</summary>
        public void Restart()
        {
            animTime = 0f;
            wipeProgress = 0f;
            maskDirty = true;
        }

        /// <summary>重建遮罩 RT（清空 + 一次 WipeMask Blit）。进度/方向/带宽变化后会自动调用。</summary>
        public void RebuildMask()
        {
            if (maskRT == null || wipeMaterial == null)
            {
                return;
            }

            wipeMaterial.SetFloat(WipeProgressId, wipeProgress);
            wipeMaterial.SetFloat(DirectionId, leftToRight ? 0f : 1f);
            wipeMaterial.SetFloat(BlendWidthId, blendWidth);

            // 清空遮罩
            RenderTexture prev = RenderTexture.active;
            RenderTexture.active = maskRT;
            GL.Clear(true, true, Color.black);
            RenderTexture.active = prev;

            Graphics.Blit(null, maskRT, wipeMaterial);

            maskDirty = false;
        }

        // ---------------------------------------------------------------- 初始化

        private void CreateMaterials()
        {
            var wipeShader = Shader.Find(WipeShaderName);
            if (wipeShader == null)
            {
                Debug.LogError($"[WipeMaskEffect] 找不到 Shader：{WipeShaderName}");
                return;
            }

            wipeMaterial = new Material(wipeShader);
        }

        private void CreateMaskRT()
        {
            // 遮罩只需要覆盖度单通道（R8）
            maskRT = new RenderTexture(Mathf.Max(1, maskSize.x), Mathf.Max(1, maskSize.y), 0, RenderTextureFormat.R8);
            maskRT.filterMode = FilterMode.Bilinear;
            maskRT.wrapMode = TextureWrapMode.Clamp;
            maskRT.name = "WipeMaskRT";

            // 设置 MaskImage（与 BoxMaskEffect 一致：直接写到输出材质的 _MaskTex）
            meshRenderer.material.SetTexture("_MaskTex", maskRT);
        }

        // ---------------------------------------------------------------- 编辑器可视化

        /// <summary>Scene 视图绘制擦除边界线（编辑/运行时都可见）。</summary>
        private void OnDrawGizmos()
        {
            Gizmos.color = new Color(1f, 0.72f, 0.2f, 0.95f);
            float x = leftToRight ? wipeProgress : 1f - wipeProgress;
            Vector3 a = UVToWorld(new Vector2(x, 0f));
            Vector3 b = UVToWorld(new Vector2(x, 1f));
            Gizmos.DrawLine(a, b);
        }

        /// <summary>显示区域的 UV → 世界坐标（以本物体渲染范围为准，见 TryGetAreaBounds）。</summary>
        private Vector3 UVToWorld(Vector2 uv)
        {
            if (TryGetAreaBounds(out Bounds b))
            {
                return new Vector3(b.min.x + uv.x * b.size.x, b.min.y + uv.y * b.size.y, b.center.z);
            }

            return transform.TransformPoint(new Vector3(uv.x - 0.5f, uv.y - 0.5f, 0f));
        }

        /// <summary>取本物体作为显示区域的渲染范围（SpriteRenderer 优先，其次 MeshRenderer）。</summary>
        private bool TryGetAreaBounds(out Bounds bounds)
        {
            var sprite = GetComponent<SpriteRenderer>();
            if (sprite != null && sprite.sprite != null)
            {
                bounds = sprite.bounds;
                return bounds.size.x > 0f && bounds.size.y > 0f;
            }

            var mesh = GetComponent<MeshRenderer>();
            if (mesh != null)
            {
                bounds = mesh.bounds;
                return bounds.size.x > 0f && bounds.size.y > 0f;
            }

            bounds = default;
            return false;
        }
    }
}
