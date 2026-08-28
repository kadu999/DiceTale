using System.Collections.Generic;
using UnityEngine;

namespace DiceTale
{
    /// <summary>
    /// 遮罩组件（组件模型下的能力组件，原 MaskObject 的遮罩部分）：
    /// 只负责持有/更新遮罩纹理，不依赖任何渲染组件。
    /// 场景中代表一张黑色遮罩（临时内存态，不持久化）：
    /// - 运行时生成全黑 <see cref="Texture2D"/>，通过 <see cref="MaskTexture"/> 暴露给外部渲染组件读取
    ///   （如 BoxComposite 的 _MaskTex）。**输出纹理实例创建一次、永不更换**，外部持有引用始终有效；
    /// - 上报尺寸（maskWidth/maskHeight）给后台（组件自己上报，IBackendComponentData），GM 页面在弹框里用鼠标擦除黑色；
    /// - 擦除结果经 erase_mask 命令（笔画轨迹）同步回来：MaskEraseStamp shader 沿轨迹硬核打点（GPU），
    ///   输出纹理 ReadPixels 同步，外部直接看到结果。
    /// 对象 ID 与显示名称由枢纽统一提供（默认自动生成唯一 ID；显示名在 BackendObject.displayName 配置）。
    /// </summary>
    public class MaskObject : BackendComponent
    {
        /// <summary>组件 ID（与客户端组件类同名，GM 面板据此渲染遮罩编辑区）。</summary>
        public override string ComponentId => "MaskObject";

        [SerializeField, Tooltip("遮罩纹理宽度（像素），GM 页面据此生成编辑画布")]
        private int maskWidth = 960;

        [SerializeField, Tooltip("遮罩纹理高度（像素），GM 页面据此生成编辑画布")]
        private int maskHeight = 540;

        private Texture2D outputTexture; // 稳定输出纹理（MaskTexture，创建一次永不更换）
        private RenderTexture maskRT;    // 遮罩当前状态（GPU 擦除目标）
        private RenderTexture blendRT;   // 擦除 ping-pong 缓冲（不能边读边写同一 RT）
        private Texture2D loadTexture;   // 复用的加载纹理（整图导入用，LoadImage 原地重设尺寸）
        private Material stampMaterial;  // 硬笔刷材质（MaskEraseStamp，沿轨迹打点用）

        private static readonly int StampCenterId = Shader.PropertyToID("_StampCenter");
        private static readonly int StampRadiusId = Shader.PropertyToID("_StampRadius");
        private static readonly int MaskSizeId = Shader.PropertyToID("_MaskSize");

        private const string StampShaderName = "DiceTale/MaskEraseStamp";

        /// <summary>遮罩纹理宽度（上报给 GM 页面）。</summary>
        public int MaskWidth => maskWidth;

        /// <summary>遮罩纹理高度（上报给 GM 页面）。</summary>
        public int MaskHeight => maskHeight;

        /// <summary>组件数据上报：遮罩尺寸（GM 属性面板的遮罩编辑区）。</summary>
        public override void AppendToInfo(Server.ServerObjectInfo info)
        {
            info.maskWidth = maskWidth;
            info.maskHeight = maskHeight;
        }

        /// <summary>稳定输出遮罩纹理（Texture2D，初始全黑；外部持有引用始终有效）。由外部渲染组件读取。</summary>
        public Texture2D MaskTexture => outputTexture;

        /// <summary>命令处理：set_mask_image / erase_mask（遮罩命令由本组件自己解析并执行，不再经枢纽转发）。</summary>
        public override bool CanHandle(string commandType) =>
            commandType == "set_mask_image" || commandType == "erase_mask";

        public override bool HandleCommand(Dictionary<string, object> msg)
        {
            switch (Server.JsonParser.GetString(msg, "type"))
            {
                case "set_mask_image":
                    ApplyMaskImage(Server.JsonParser.GetString(msg, "image"));
                    return true;

                case "erase_mask":
                    return HandleEraseStroke(msg);

                default:
                    return false;
            }
        }

        /// <summary>解析 GM 擦除笔画轨迹（归一化点 + 归一化半径 + 软边比例）并应用。少于两个点没有线段，忽略。</summary>
        private bool HandleEraseStroke(Dictionary<string, object> msg)
        {
            var stroke = Server.JsonParser.GetObject(msg, "stroke");
            if (stroke == null)
            {
                return false;
            }

            var rawPoints = Server.JsonParser.GetArray(stroke, "points");
            if (rawPoints == null || rawPoints.Count < 2)
            {
                return false;
            }

            var points = new Vector2[rawPoints.Count];
            for (int i = 0; i < rawPoints.Count; i++)
            {
                if (rawPoints[i] is Dictionary<string, object> p)
                {
                    points[i] = new Vector2(
                        (float)Server.JsonParser.GetNumber(p, "x"),
                        (float)Server.JsonParser.GetNumber(p, "y"));
                }
            }

            var radius = (float)Server.JsonParser.GetNumber(stroke, "radius");
            var softness = (float)Server.JsonParser.GetNumber(stroke, "softness");
            ApplyEraseStroke(points, radius, softness);
            return true;
        }

        protected override void OnEnable()
        {
            base.OnEnable(); // 通知枢纽刷新能力组件列表（基类内置）

            EnsureOutputTexture();
            EnsureMaskRT();
            EnsureStampMaterial();
        }

        private void OnDisable()
        {
            ReleaseResources(); // 只释放 RT/材质；outputTexture 保留，身份不变
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

        /// <summary>创建 GPU 擦除用 RenderTexture（maskRT = 当前状态，blendRT = ping-pong 缓冲；只创建一次）。
        /// 初始内容 = 当前输出纹理（首次为全黑；重启用保留上次擦除结果，不会闪黑）。</summary>
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

            Graphics.Blit(outputTexture, maskRT);
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

        /// <summary>确保硬笔刷材质存在（MaskEraseStamp，仅 Blit 用）。</summary>
        private void EnsureStampMaterial()
        {
            if (stampMaterial != null)
            {
                return;
            }

            var shader = Shader.Find(StampShaderName);
            if (shader == null)
            {
                Debug.LogError($"[MaskObject] 找不到 Shader：{StampShaderName}");
                return;
            }

            stampMaterial = new Material(shader);
            stampMaterial.name = "MaskEraseStampMat";
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

        /// <summary>后台命令入口：整图导入（base64 PNG）——直接替换当前遮罩，无过渡。</summary>
        public void ApplyMaskImage(string base64Png)
        {
            if (string.IsNullOrEmpty(base64Png))
            {
                return;
            }

            EnsureOutputTexture();
            EnsureMaskRT();
            EnsureLoadTexture();

            if (!loadTexture.LoadImage(System.Convert.FromBase64String(base64Png)))
            {
                Debug.LogWarning($"[MaskObject] Failed to decode mask image: {name}");
                return;
            }

            Graphics.Blit(loadTexture, maskRT);
            SyncOutputTexture();
            Debug.Log($"[MaskObject] {name}: mask image applied ({loadTexture.width}x{loadTexture.height})");
        }

        /// <summary>后台命令入口：应用 GM 擦除的笔画轨迹。
        /// 用 MaskEraseStamp shader 沿线段打硬核圆（destination-out，ping-pong 到 maskRT），
        /// 再同步到稳定输出纹理。边缘统一为硬边（无额外羽化 pass）。</summary>
        public void ApplyEraseStroke(Vector2[] points, float radius, float softness)
        {
            if (points == null || points.Length < 2)
            {
                return;
            }

            EnsureOutputTexture();
            EnsureMaskRT();
            EnsureStampMaterial();
            if (maskRT == null || blendRT == null || outputTexture == null || stampMaterial == null)
            {
                Debug.LogWarning($"[MaskObject] {name}: 擦除被跳过（RT/材质未就绪，请检查 MaskEraseStamp Shader 是否导入）");
                return;
            }

            var maskSize = new Vector2(maskRT.width, maskRT.height);
            var radiusTex = Mathf.Max(1f, radius * maskRT.width); // 归一化半径 → 纹理像素

            stampMaterial.SetVector(MaskSizeId, maskSize);
            stampMaterial.SetFloat(StampRadiusId, radiusTex);

            // 硬核擦除：沿线段打硬圆（shader：d < radius 全擦）
            var step = Mathf.Max(1f, radiusTex * 0.5f);
            for (int i = 0; i < points.Length - 1; i++)
            {
                var from = new Vector2(points[i].x * maskRT.width, points[i].y * maskRT.height);
                var to = new Vector2(points[i + 1].x * maskRT.width, points[i + 1].y * maskRT.height);
                var distance = (to - from).magnitude;
                var samples = Mathf.Max(1, Mathf.CeilToInt(distance / step));
                for (int s = 0; s <= samples; s++)
                {
                    var center = Vector2.Lerp(from, to, s / (float)samples);

                    // destination-out 打点：ping-pong（读 maskRT 写 blendRT，再拷回 maskRT）
                    stampMaterial.SetVector(StampCenterId, center);
                    Graphics.Blit(maskRT, blendRT, stampMaterial);
                    Graphics.Blit(blendRT, maskRT);
                }
            }

            SyncOutputTexture();

            // 诊断：采样笔画起点附近的输出纹理 alpha——0 说明 shader 擦除已写入输出，1 说明链路有问题
            if (points.Length > 0 && outputTexture != null)
            {
                var px = Mathf.Clamp(Mathf.RoundToInt(points[0].x * outputTexture.width), 0, outputTexture.width - 1);
                var py = Mathf.Clamp(Mathf.RoundToInt(points[0].y * outputTexture.height), 0, outputTexture.height - 1);
                var sample = outputTexture.GetPixel(px, py);
                Debug.Log($"[MaskObject] {name}: 输出纹理采样 alpha={sample.a:F2} (起点 {px},{py})");
            }

            Debug.Log($"[MaskObject] {name}: erase stroke ({points.Length} points, r={radiusTex}, soft={softness})");
        }

        private void ReleaseResources()
        {
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

            if (stampMaterial != null)
            {
                Destroy(stampMaterial);
                stampMaterial = null;
            }

            // outputTexture 不销毁：实例身份永不变，外部引用始终有效；重新 Enable 时复用
        }
    }
}
