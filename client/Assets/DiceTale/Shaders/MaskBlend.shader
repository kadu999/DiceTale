// 遮罩时间过渡混合 Shader（仅供 MaskObject 内部 Graphics.Blit 交叉淡化用，不用于任何显示材质）：
//   _MainTex   = 当前遮罩（Blit 时自动绑定源）
//   _TargetTex = 目标遮罩（GM 最新擦除结果）
//   _Progress  = 0~1 过渡进度
// 输出 = lerp(_MainTex, _TargetTex, _Progress)：MaskObject 每帧把结果 Blit 回自身的遮罩 RenderTexture，
// 让 BoxComposite 等外部显示材质读到的遮罩随时间平滑渐变（新增擦除区域淡入，不瞬间跳变）。
Shader "DiceTale/MaskBlend"
{
    Properties
    {
        _MainTex ("当前遮罩", 2D) = "white" {}
        _TargetTex ("目标遮罩", 2D) = "white" {}
        _Progress ("过渡进度 (0~1)", Range(0, 1)) = 1
    }
    SubShader
    {
        Tags { "Queue"="Transparent" "RenderType"="Transparent" "IgnoreProjector"="True" }
        Blend Off
        Cull Off
        ZWrite Off

        Pass
        {
            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #include "UnityCG.cginc"

            sampler2D _MainTex;
            sampler2D _TargetTex;
            float _Progress;

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
                fixed4 current = tex2D(_MainTex, i.uv);
                fixed4 target = tex2D(_TargetTex, i.uv);
                return lerp(current, target, saturate(_Progress));
            }
            ENDCG
        }
    }
}
