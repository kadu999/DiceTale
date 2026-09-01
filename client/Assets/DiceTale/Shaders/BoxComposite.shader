// 双纹理框选合成 Shader：
//   两种用法：
//   a) 直接挂到输出 MeshRenderer 的材质上（推荐，输出到 MeshRenderer）：
//      _MainTex = 背景纹理（纹理1）、_EffectTex = 效果纹理（纹理2）、_MaskTex = 框遮罩（RectMask 画出的 RT），
//      mesh 直接渲染合成结果，无需额外合成 RT。
//   b) 配合 Graphics.Blit(背景纹理, 目标, 本材质) 使用（_MainTex 由 Blit 自动传入源纹理）。
//   一对一混合：两张纹理都按同一套 quad UV 采样，遮罩 alpha 直接作为混合权重——
//              mask.a = 0（擦除/覆盖侧）显示效果纹理（纹理2），mask.a = 1（黑/未覆盖侧）显示背景纹理（纹理1），
//              中间值 = 半透明边缘：两张图在羽化带内按 alpha 线性交叉混合，融合自然。
//   边缘羽化由各遮罩生成端负责（RectMask._EdgeSoftness / WipeMask._BlendWidth / MaskEraseStamp._StampSoftness）；
//   _MaskEdgeSoftness 只做端点截止：0 = 完全线性跟随遮罩（默认），越大混合带越窄，0.5 = 退化为硬边。
Shader "DiceTale/BoxComposite"
{
    Properties
    {
        _MainTex ("背景纹理 (纹理1)", 2D) = "white" {}
        _StaticTex ("静态纹理 (纹理2)", 2D) = "white" {}
        _MaskTex ("框遮罩", 2D) = "black" {}
        _BackgroundTint ("背景纹理颜色", Color) = (1, 1, 1, 1)
        _StaticTint ("静态纹理颜色", Color) = (1, 1, 1, 1)
        _MaskEdgeSoftness ("遮罩端点截止比例 (0=线性, 0.5=硬边)", Range(0, 0.5)) = 0.05
    }
    SubShader
    {
        Tags { "Queue"="Transparent" "RenderType"="Transparent" "IgnoreProjector"="True" }
        Blend SrcAlpha OneMinusSrcAlpha
        Cull Off
        ZWrite Off

        Pass
        {
            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #include "UnityCG.cginc"

            sampler2D _MainTex;
            sampler2D _StaticTex;
            sampler2D _MaskTex;
            fixed4 _BackgroundTint;
            fixed4 _StaticTint;
            float _MaskEdgeSoftness;

            struct appdata
            {
                float4 vertex : POSITION;
                float2 uv : TEXCOORD0;
            };

            struct v2f
            {
                float2 uv : TEXCOORD0;
                float4 vertex : SV_POSITION;
            };

            v2f vert(appdata v)
            {
                v2f o;
                o.vertex = UnityObjectToClipPos(v.vertex);
                o.uv = v.uv;
                return o;
            }

            fixed4 frag(v2f i) : SV_Target
            {
                float2 uv = i.uv;

                fixed4 mask = tex2D(_MaskTex, uv);
                fixed4 bg = tex2D(_MainTex, uv) * _BackgroundTint;
                fixed4 fx = tex2D(_StaticTex, uv) * _StaticTint;

                // 遮罩 alpha 直接作为混合权重：mask.a = 0 → 纹理2（效果），mask.a = 1 → 纹理1（背景），
                // 中间值 = 半透明边缘，两张图按 alpha 线性交叉混合——羽化带整体成为融合区（不再以 0.5 为界截断）。
                // _MaskEdgeSoftness：端点截止比例——0 完全线性跟随遮罩；越大混合带越窄；0.5 退化为硬边。
                float edge = saturate(_MaskEdgeSoftness);
                float t = saturate((mask.a - edge) / max(1.0 - 2.0 * edge, 1e-4));
                float coverage = 1.0 - t;
                return lerp(fx, bg, coverage);
            }
            ENDCG
        }
    }
}
