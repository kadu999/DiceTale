using UnityEngine;

namespace DiceTale
{
    /// <summary>
    /// 遮罩对象：继承 <see cref="BackendObject"/>（纯后台通信），只负责持有/更新遮罩纹理，不依赖任何渲染组件。
    /// 场景中代表一张黑色遮罩（临时内存态，不持久化）：
    /// - 运行时生成全黑 <see cref="Texture2D"/>，通过 <see cref="MaskTexture"/> 暴露给外部渲染组件读取
    ///   （如 BoxComposite 的 _MaskTex）。**输出纹理实例创建一次、永不更换**，外部持有引用始终有效；
    /// - 上报尺寸（maskWidth/maskHeight）给后台，GM 页面在弹框里用鼠标擦除黑色；
    /// - 擦除结果经 set_mask_image 命令（base64 PNG）同步回来：只更新目标（不打断进行中的淡化），
    ///   用 Graphics.Blit（GPU）在 <see cref="transitionTime"/> 内把遮罩**持续追赶**最新目标，
    ///   图像流停止后自然收敛到最终状态；输出纹理每帧 ReadPixels 同步，外部直接看到过渡。
    /// </summary>
    public class MaskObject : BackendObject
    {
        [SerializeField, Tooltip("遮罩纹理宽度（像素），GM 页面据此生成编辑画布")]
        private int maskWidth = 960;

        [SerializeField, Tooltip("遮罩纹理高度（像素），GM 页面据此生成编辑画布")]
        private int maskHeight = 540;

        [SerializeField, Tooltip("遮罩更新过渡时间（秒）：遮罩从当前状态平滑追赶最新目标；0 = 立即切换")]
        private float transitionTime = 0.5f;

        private Texture2D outputTexture; // 稳定输出纹理（MaskTexture，创建一次永不更换）
        private RenderTexture maskRT;    // GPU 过渡用当前状态
        private RenderTexture blendRT;   // 过渡中间缓冲
        private Texture2D loadTexture;   // 复用的加载/目标纹理（LoadImage 原地重设尺寸，避免每张新图新建分配）
        private Texture2D pendingTarget; // 最新收到的目标纹理（复用 loadTexture 实例）
        private Material blendMaterial;  // 内部混合材质（MaskBlend，仅 Blit 用）
        private float crossfadeProgress = 1f; // 1 = 无过渡/已完成

        private string maskId;

        private static readonly int TargetTexId = Shader.PropertyToID("_TargetTex");
        private static readonly int ProgressId = Shader.PropertyToID("_Progress");

        private const string BlendShaderName = "DiceTale/MaskBlend";

        /// <summary>后台对象 ID：首次访问时自动生成唯一 ID（Guid + 物体名，便于 GM 排查）。</summary>
        public override string ObjectId
        {
            get
            {
                if (string.IsNullOrEmpty(maskId))
                {
                    maskId = $"{gameObject.name}_{System.Guid.NewGuid():N}";
                }

                return maskId;
            }
        }

        /// <summary>遮罩纹理宽度（上报给 GM 页面）。</summary>
        public override int MaskWidth => maskWidth;

        /// <summary>遮罩纹理高度（上报给 GM 页面）。</summary>
        public override int MaskHeight => maskHeight;

        /// <summary>稳定输出遮罩纹理（Texture2D，初始全黑；淡化期间为中间态）。
        /// 实例创建一次永不更换，外部持有引用始终有效。由外部渲染组件读取。</summary>
        public Texture2D MaskTexture => outputTexture;

        protected override void OnEnable()
        {
            base.OnEnable(); // 注册到后台（必须调用基类，否则不会上报 GM 页面）
            EnsureOutputTexture();
            EnsureMaskRT();
            EnsureBlendMaterial();
        }

        protected override void OnDisable()
        {
            base.OnDisable(); // 必须调用基类：从 BackendRegistry 注销
            ReleaseResources(); // 只释放 RT/材质；outputTexture 保留，身份不变
        }

        private void Update()
        {
            if (pendingTarget == null || maskRT == null || outputTexture == null || blendMaterial == null)
            {
                return;
            }

            crossfadeProgress = Mathf.MoveTowards(crossfadeProgress, 1f, Time.deltaTime / Mathf.Max(0.01f, transitionTime));
            if (crossfadeProgress >= 1f)
            {
                // 淡化完成：最新目标直接写入遮罩 RT，再同步到稳定输出纹理
                Graphics.Blit(pendingTarget, maskRT);
                SyncOutputTexture();
                pendingTarget = null; // loadTexture 复用，不销毁
                return;
            }

            // GPU 混合：blendRT = lerp(maskRT, pendingTarget, t)，再拷回 maskRT，最后同步到稳定输出纹理
            // （持续追赶最新目标：中途换目标不清零进度，图像流停止后自然收敛）
            blendMaterial.SetTexture(TargetTexId, pendingTarget);
            blendMaterial.SetFloat(ProgressId, crossfadeProgress);
            Graphics.Blit(maskRT, blendRT, blendMaterial);
            Graphics.Blit(blendRT, maskRT);
            SyncOutputTexture();
        }

        /// <summary>创建稳定输出纹理（初始全黑；只创建一次，之后复用，身份不变）。</summary>
        private void EnsureOutputTexture()
        {
            var width = Mathf.Max(8, maskWidth);
            var height = Mathf.Max(8, maskHeight);

            if (outputTexture != null)
            {
                return;
            }

            outputTexture = new Texture2D(width, height, TextureFormat.RGBA32, false);
            outputTexture.name = "MaskOutputTexture";
            outputTexture.wrapMode = TextureWrapMode.Clamp;
            outputTexture.filterMode = FilterMode.Bilinear;

            var colors = new Color[width * height];
            for (int i = 0; i < colors.Length; i++)
            {
                colors[i] = Color.black;
            }

            outputTexture.SetPixels(colors);
            outputTexture.Apply();
        }

        /// <summary>创建 GPU 过渡用 RenderTexture（初始内容 = 当前输出纹理；只创建一次，避免闪黑）。</summary>
        private void EnsureMaskRT()
        {
            var width = Mathf.Max(8, maskWidth);
            var height = Mathf.Max(8, maskHeight);

            if (maskRT != null)
            {
                return;
            }

            maskRT = new RenderTexture(width, height, 0, RenderTextureFormat.ARGB32);
            maskRT.name = "MaskRT";
            maskRT.wrapMode = TextureWrapMode.Clamp;
            maskRT.filterMode = FilterMode.Bilinear;
            blendRT = new RenderTexture(width, height, 0, RenderTextureFormat.ARGB32);
            blendRT.name = "MaskBlendRT";
            blendRT.wrapMode = TextureWrapMode.Clamp;
            blendRT.filterMode = FilterMode.Bilinear;

            // 用当前输出纹理初始化（首次为全黑；重启用保留上次擦除结果，不会闪黑）
            Graphics.Blit(outputTexture, maskRT);
        }

        private void EnsureBlendMaterial()
        {
            if (blendMaterial != null)
            {
                return;
            }

            var shader = Shader.Find(BlendShaderName);
            if (shader == null)
            {
                Debug.LogError($"[MaskObject] 找不到 Shader：{BlendShaderName}");
                return;
            }

            blendMaterial = new Material(shader);
            blendMaterial.name = "MaskBlendMat";
        }

        /// <summary>确保复用的加载纹理存在（LoadImage 会按图尺寸原地重设，实例保持一个，减少 GC）。</summary>
        private void EnsureLoadTexture()
        {
            if (loadTexture != null)
            {
                return;
            }

            loadTexture = new Texture2D(2, 2, TextureFormat.RGBA32, false);
            loadTexture.name = "MaskLoadTexture";
            loadTexture.wrapMode = TextureWrapMode.Clamp;
            loadTexture.filterMode = FilterMode.Bilinear;
        }

        /// <summary>把遮罩 RT 当前内容读回稳定输出纹理（外部读取 MaskTexture 直接看到最新状态）。</summary>
        private void SyncOutputTexture()
        {
            if (maskRT == null || outputTexture == null)
            {
                return;
            }

            var prev = RenderTexture.active;
            RenderTexture.active = maskRT;
            outputTexture.ReadPixels(new Rect(0, 0, outputTexture.width, outputTexture.height), 0, 0);
            outputTexture.Apply();
            RenderTexture.active = prev;
        }

        /// <summary>后台命令入口：应用 GM 擦除后的遮罩图（base64 PNG）。
        /// 只更新目标：不打断进行中的淡化（进度不清零），空闲时才从 0 开始；持续追赶最新目标。</summary>
        public override void ApplyMaskImage(string base64Png)
        {
            if (string.IsNullOrEmpty(base64Png))
            {
                return;
            }

            EnsureOutputTexture();
            EnsureMaskRT();
            EnsureBlendMaterial();
            EnsureLoadTexture();

            if (!loadTexture.LoadImage(System.Convert.FromBase64String(base64Png)))
            {
                Debug.LogWarning($"[MaskObject] Failed to decode mask image: {ObjectId}");
                return;
            }

            pendingTarget = loadTexture; // 复用同一实例，不新建
            if (crossfadeProgress >= 1f)
            {
                crossfadeProgress = 0f; // 空闲：开始淡化；淡化中：保持进度继续追赶
            }
            Debug.Log($"[MaskObject] {ObjectId}: mask updated ({loadTexture.width}x{loadTexture.height}), fade {transitionTime}s");
        }

        private void ReleaseResources()
        {
            pendingTarget = null; // 与 loadTexture 同实例，由下方统一释放

            if (loadTexture != null)
            {
                Destroy(loadTexture);
                loadTexture = null;
            }

            if (maskRT != null)
            {
                maskRT.Release();
                Destroy(maskRT);
                maskRT = null;
            }

            if (blendRT != null)
            {
                blendRT.Release();
                Destroy(blendRT);
                blendRT = null;
            }

            if (blendMaterial != null)
            {
                Destroy(blendMaterial);
                blendMaterial = null;
            }
            // outputTexture 不销毁：实例身份永不变，外部引用始终有效；重新 Enable 时复用
        }
    }
}