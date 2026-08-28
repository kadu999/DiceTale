using System.Collections.Generic;
using UnityEngine;

namespace DiceTale
{
    /// <summary>
    /// Graphics.Blit 版双纹理框选，框由 SpriteRenderer 列表驱动：
    ///   1. boxSprites 列表里每个 SpriteRenderer 的世界范围自动成为一个框（实时跟随 sprite 的位置/大小，
    ///      数量无上限）。重建遮罩：清空 maskRT，每个框一次 Graphics.Blit(null, maskRT, "DiceTale/RectMask")，
    ///      BlendOp Max 取并集；
    ///   2. 合成结果直接输出到 MeshRenderer：输出材质用 "DiceTale/BoxComposite"，
    ///      在 mesh 上采样 背景纹理（纹理1）/ 效果纹理（纹理2）/ 遮罩 直接渲染，无需额外合成 RT。
    ///   输出目标：
    ///     - 指定 outputRenderer（推荐）：把合成材质（自动实例化，不落盘）赋给它，每帧推送属性；
    ///     - 或调用 Composite() 自己接 Blit 管线（输出到自定义 RenderTexture）。
    /// 用法：Inspector 的 boxSprites 列表拖入 SpriteRenderer，或代码里 AddBoxSprite / RemoveBoxSprite /
    ///       ClearBoxSprites；移动/缩放 sprite 即编辑框范围（Scene 视图有黄色框线预览）。
    /// 建议把脚本挂到背景 quad 或背景 SpriteRenderer 所在物体上（WorldToUV 以本物体渲染范围为基准）。
    /// </summary>
    public class BoxMaskEffect : MonoBehaviour
    {
        [Header("输出")]
        [Tooltip("合成结果输出到哪个 MeshRenderer（把合成材质赋给它，每帧推送属性）")]
        [SerializeField]
        private MeshRenderer  meshRenderer;

        [Header("合成")]
        [Tooltip("框边缘羽化（UV 单位，0 = 硬边）")]
        [SerializeField]
        private float edgeSoftness = 0.02f;

        [Tooltip("遮罩分辨率（框是纯矩形，可以低一些）")]
        [SerializeField]
        private Vector2Int maskSize = new Vector2Int(512, 512);

        [Header("框（由 SpriteRenderer 驱动）")]
        [Tooltip("列表里的每个 SpriteRenderer 自动成为一个框，实时跟随 sprite 的位置/大小；只有正在显示（enabled 且 active）的 sprite 才生效，隐藏即消失")]
        [SerializeField]
        private List<SpriteRenderer> boxSprites = new List<SpriteRenderer>();

        private Material maskMaterial;
        private RenderTexture maskRT;

        private bool maskDirty = true;

        private static readonly int MainTexId = Shader.PropertyToID("_MainTex");
        private static readonly int EffectTexId = Shader.PropertyToID("_EffectTex");
        private static readonly int MaskTexId = Shader.PropertyToID("_MaskTex");
        private static readonly int RectCenterId = Shader.PropertyToID("_RectCenter");
        private static readonly int RectSizeId = Shader.PropertyToID("_RectSize");
        private static readonly int EdgeSoftnessId = Shader.PropertyToID("_EdgeSoftness");

        private const string MaskShaderName = "DiceTale/RectMask";

        /// <summary>当前框（sprite）的数量。</summary>
        public int BoxCount => boxSprites.Count;

        protected virtual void Awake()
        {
            CreateMaterials();
            CreateMaskRT();
        }

        protected virtual void Update()
        {
            if (boxSprites.Count > 0)
            {
                // sprite 驱动的框：每帧按 sprite 当前位置重建遮罩，位置/大小变化实时生效
                maskDirty = true;
            }

            if (maskDirty)
            {
                RebuildMask();
            }
        }

        protected virtual void OnDestroy()
        {
            if (maskRT != null)
            {
                maskRT.Release();
            }

            if (maskMaterial != null)
            {
                Destroy(maskMaterial);
            }

            // 注意：赋给外部 outputRenderer 的材质实例（activeOutputMaterial）不在这里销毁，
            // 避免退出 Play 后 renderer 挂到已销毁的材质上（由 Unity 在域重载时回收）。
        }

        // ---------------------------------------------------------------- 公开 API

        /// <summary>把某个 SpriteRenderer 加入框列表（实时跟随 sprite）。</summary>
        public void AddBoxSprite(SpriteRenderer sprite)
        {
            if (sprite == null || boxSprites.Contains(sprite))
            {
                return;
            }

            boxSprites.Add(sprite);
            maskDirty = true;
        }

        /// <summary>从框列表移除某个 SpriteRenderer。</summary>
        public void RemoveBoxSprite(SpriteRenderer sprite)
        {
            if (boxSprites.Remove(sprite))
            {
                maskDirty = true;
            }
        }

        /// <summary>清空框列表（只显示背景纹理）。</summary>
        public void ClearBoxSprites()
        {
            if (boxSprites.Count == 0)
            {
                return;
            }

            boxSprites.Clear();
            maskDirty = true;
        }

        /// <summary>重建遮罩 RT（清空 + 每个 sprite 框一次 Blit）。列表变化或 sprite 移动后会自动调用，一般无需手动。</summary>
        public void RebuildMask()
        {
            if (maskRT == null || maskMaterial == null)
            {
                return;
            }

            maskMaterial.SetFloat(EdgeSoftnessId, edgeSoftness);

            // 清空遮罩
            RenderTexture prev = RenderTexture.active;
            RenderTexture.active = maskRT;
            GL.Clear(true, true, Color.black);
            RenderTexture.active = prev;

            // 每个 sprite 一个框：BlendOp Max 取并集
            for (int i = 0; i < boxSprites.Count; i++)
            {
                if (TryGetSpriteRectUV(boxSprites[i], out Vector2 center, out Vector2 size))
                {
                    DrawBoxToMask(new Vector4(center.x, center.y, 0f, 0f), new Vector4(size.x, size.y, 0f, 0f));
                }
            }

            maskDirty = false;
        }

        /// <summary>把一个框 Blit 进遮罩（BlendOp Max 取并集）。</summary>
        private void DrawBoxToMask(Vector4 center, Vector4 size)
        {
            if (size.x <= 0f || size.y <= 0f)
            {
                return;
            }

            maskMaterial.SetVector(RectCenterId, center);
            maskMaterial.SetVector(RectSizeId, size);
            Graphics.Blit(null, maskRT, maskMaterial);
        }

        /// <summary>
        /// 世界坐标 → 显示区域的 UV（0~1）。
        /// 以本物体渲染范围为准：SpriteRenderer 或 MeshRenderer 的世界轴对齐范围就是 0~1 空间；
        /// 都没有（或不在物体上）时回退为 1×1 内置 quad 的局部空间换算（局部坐标 + 0.5）。
        /// </summary>
        public Vector2 WorldToUV(Vector3 world)
        {
            if (TryGetAreaBounds(out Bounds b))
            {
                return new Vector2((world.x - b.min.x) / b.size.x, (world.y - b.min.y) / b.size.y);
            }

            Vector3 local = transform.InverseTransformPoint(world);
            return new Vector2(local.x + 0.5f, local.y + 0.5f);
        }

        /// <summary>显示区域的 UV → 世界坐标（WorldToUV 的逆运算）。</summary>
        public Vector3 UVToWorld(Vector2 uv)
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

        /// <summary>
        /// SpriteRenderer 的世界轴对齐范围 → Box UV（相对本物体的显示区域）。
        /// 只有"正在显示"的 sprite 才返回 true：未启用（enabled=false）、物体未激活（active=false）
        /// 或未指定 sprite 图，都视为不可见、不生成框。实时生效（每帧重建遮罩时重新检测）。
        /// 注意：sprite 旋转时取其世界外接框（AABB），框始终是轴对齐矩形。
        /// </summary>
        public bool TryGetSpriteRectUV(SpriteRenderer sprite, out Vector2 center, out Vector2 size)
        {
            center = Vector2.zero;
            size = Vector2.zero;
            if (sprite == null || !sprite.gameObject.activeSelf || sprite.sprite == null)
            {
                return false;
            }

            Bounds b = sprite.bounds; // 世界空间 AABB
            Vector2 uvMin = WorldToUV(b.min);
            Vector2 uvMax = WorldToUV(b.max);
            center = (uvMin + uvMax) * 0.5f;
            size = new Vector2(Mathf.Abs(uvMax.x - uvMin.x), Mathf.Abs(uvMax.y - uvMin.y));
            return size.x > 0f && size.y > 0f;
        }

        // ---------------------------------------------------------------- 初始化

        private void CreateMaterials()
        {
            var maskShader = Shader.Find(MaskShaderName);
            if (maskShader == null)
            {
                Debug.LogError($"[BoxMaskEffect] 找不到 Shader：{MaskShaderName}");
                return;
            }

            maskMaterial = new Material(maskShader);
            maskMaterial.SetFloat(EdgeSoftnessId, edgeSoftness);
        }

        private void CreateMaskRT()
        {
            // 遮罩只需要覆盖度单通道（R8），框是纯矩形、无其它信息要存
            maskRT = new RenderTexture(Mathf.Max(1, maskSize.x), Mathf.Max(1, maskSize.y), 0, RenderTextureFormat.R8);
            maskRT.filterMode = FilterMode.Bilinear;
            maskRT.wrapMode = TextureWrapMode.Clamp;
            maskRT.name = "BoxMaskRT";

            // 设置Mask
            meshRenderer.material.SetTexture("_MaskTex", maskRT);
        }

        // ---------------------------------------------------------------- 编辑器可视化

        /// <summary>Scene 视图绘制框范围（编辑/运行时都可见；框 = boxSprites 里每个 sprite 的范围）。</summary>
        private void OnDrawGizmos()
        {
            Gizmos.color = new Color(1f, 0.72f, 0.2f, 0.95f);
            for (int i = 0; i < boxSprites.Count; i++)
            {
                if (TryGetSpriteRectUV(boxSprites[i], out Vector2 center, out Vector2 size))
                {
                    DrawBoxGizmo(center, size);
                }
            }
        }

        private void DrawBoxGizmo(Vector2 center, Vector2 size)
        {
            if (size.x <= 0f || size.y <= 0f)
            {
                return;
            }

            Vector2 half = size * 0.5f;
            Vector3 p0 = UVToWorld(new Vector2(center.x - half.x, center.y - half.y));
            Vector3 p1 = UVToWorld(new Vector2(center.x + half.x, center.y - half.y));
            Vector3 p2 = UVToWorld(new Vector2(center.x + half.x, center.y + half.y));
            Vector3 p3 = UVToWorld(new Vector2(center.x - half.x, center.y + half.y));
            Gizmos.DrawLine(p0, p1);
            Gizmos.DrawLine(p1, p2);
            Gizmos.DrawLine(p2, p3);
            Gizmos.DrawLine(p3, p0);
        }
    }
}
