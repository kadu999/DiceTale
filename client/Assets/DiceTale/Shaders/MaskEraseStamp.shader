// 遮罩笔刷 stamp Shader（MaskObject 内部用 Graphics.Blit 沿轨迹打点，不用于显示材质）：
//   硬核擦除：d < radius 全擦（alpha=1），边界外不擦。
//   _MainTex = 当前遮罩（Blit 时自动绑定源 maskRT）——必须采样它作为基底。
Shader "DiceTale/MaskEraseStamp"
{
    Properties
    {
        _MainTex ("当前遮罩", 2D) = "white" {}
        _StampCenter ("中心 (纹理像素)", Vector) = (0, 0, 0, 0)
        _StampRadius ("半径 (纹理像素)", Float) = 10
        _MaskSize ("纹理尺寸", Vector) = (960, 540, 0, 0)
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
            float4 _StampCenter;
            float _StampRadius;
            float4 _MaskSize;

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
                fixed4 base = tex2D(_MainTex, i.uv); // 当前遮罩（Blit 源）

                float2 pos = i.uv * _MaskSize.xy; // 纹理像素坐标（非正方形纹理上仍是正圆）
                float d = distance(pos, _StampCenter.xy);
                float stampAlpha = 1.0 - step(_StampRadius, d); // 硬核：d < radius 全擦

                base.a *= (1.0 - stampAlpha); // destination-out
                return base;
            }
            ENDCG
        }
    }
}