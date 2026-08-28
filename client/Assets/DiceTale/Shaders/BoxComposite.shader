// 双纹理框选合成 Shader：
//   两种用法：
//   a) 直接挂到输出 MeshRenderer 的材质上（推荐，输出到 MeshRenderer）：
//      _MainTex = 背景纹理（纹理1）、_EffectTex = 效果纹理（纹理2）、_MaskTex = 框遮罩（RectMask 画出的 RT），
//      mesh 直接渲染合成结果，无需额外合成 RT。
//   b) 配合 Graphics.Blit(背景纹理, 目标, 本材质) 使用（_MainTex 由 Blit 自动传入源纹理）。
//   一对一混合：两张纹理都按同一套 quad UV 采样，覆盖侧（mask.a < 0.5）显示效果纹理（纹理2），
//              未覆盖侧显示背景纹理（纹理1），交界按 mask.a 平滑交叉混合。
//   边缘虚化：_MaskEdgeSoftness 控制交界过渡带宽度（UV 单位，对应 WipeMaskEffect 的 blendWidth 概念），
//             以 mask.a = 0.5 为界做 smoothstep——即使遮罩纹理是硬边，渲染时也会得到平滑羽化边缘。
Shader "DiceTale/BoxComposite"
{
    Properties
    {
        _MainTex ("背景纹理 (纹理1)", 2D) = "white" {}
        _EffectTex ("效果纹理 (纹理2)", 2D) = "white" {}
        _MaskTex ("框遮罩", 2D) = "black" {}
        _BackgroundTint ("背景纹理颜色", Color) = (1, 1, 1, 1)
        _EffectTint ("效果纹理颜色", Color) = (1, 1, 1, 1)
        _MaskEdgeSoftness ("遮罩边缘虚化宽度 (UV)", Range(0, 0.2)) = 0.05
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
            sampler2D _EffectTex;
            sampler2D _MaskTex;
            fixed4 _BackgroundTint;
            fixed4 _EffectTint;
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
                fixed4 fx = tex2D(_EffectTex, uv) * _EffectTint;

                // 一对一混合：覆盖侧（mask.a < 0.5）显示效果纹理，未覆盖侧显示背景纹理。
                // 边缘虚化：以 mask.a = 0.5 为界、_MaskEdgeSoftness 为带宽做 smoothstep，
                // 即使遮罩纹理是硬边也能得到平滑羽化边缘（对应 WipeMaskEffect 的 blendWidth 思路）。
                float edge = max(_MaskEdgeSoftness, 1e-4);
                float coverage = 1.0 - smoothstep(0.5 - edge, 0.5 + edge, mask.a);
                return lerp(bg, fx, coverage);
            }
            ENDCG
        }
    }
}
