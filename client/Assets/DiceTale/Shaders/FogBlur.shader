Shader "DiceTale/FogBlur"
{
    Properties
    {
        _MainTex ("Fog State", 2D) = "white" {}
        _GridSize ("Grid Size", Vector) = (64, 36, 0, 0)
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
            float4 _MainTex_TexelSize;
            float2 _GridSize;

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
                fixed4 center = tex2D(_MainTex, i.uv);
                // return fixed4(center.r, center.g, center.b, 0);

                // 已清除的雾格子（alpha=0 但曾是雾、RGB 非 0）：保持透明并保留 RGB 标记，
                // 使多次模糊链中持续可识别，不被外部雾回填
                float centerRgb = center.r + center.g + center.b;
                bool isClearedFog = center.a < 0.5 && centerRgb > 0.1;
                if (isClearedFog)
                {
                    return fixed4(center.r, center.g, center.b, 0);
                }

                // 地图四边 1 格内不平滑（保持干脆，不向边界外扩散）
                float2 cell = float2(1.0 / max(_GridSize.x, 1.0), 1.0 / max(_GridSize.y, 1.0));
                bool nearEdge = i.uv.x < cell.x * 1.5 || i.uv.x > 1.0 - cell.x * 1.5
                             || i.uv.y < cell.y * 1.5 || i.uv.y > 1.0 - cell.y * 1.5;
                if (nearEdge)
                {
                    return center;
                }

                // 3x3 高斯模糊（GPU 羽化雾边缘）
                float2 texel = _MainTex_TexelSize.xy;
                float weights[3][3] =
                {
                    { 1.0, 2.0, 1.0 },
                    { 2.0, 4.0, 2.0 },
                    { 1.0, 2.0, 1.0 }
                };

                fixed4 col = 0.0;
                float total = 0.0;
                for (int dy = -1; dy <= 1; dy++)
                {
                    for (int dx = -1; dx <= 1; dx++)
                    {
                        fixed4 neighbor = tex2D(_MainTex, i.uv + float2(dx, dy) * texel);

                        // 已揭示的雾格子（曾是雾、现已清除，alpha=0 但 RGB 非 0）不参与模糊，
                        // 避免揭示区域影响相邻雾的边缘
                        float rgbSum = neighbor.r + neighbor.g + neighbor.b;
                        bool isRevealedFog = neighbor.a < 0.5 && rgbSum > 0.1;
                        if (isRevealedFog)
                        {
                            continue;
                        }

                        col += neighbor * weights[dy + 1][dx + 1];
                        total += weights[dy + 1][dx + 1];
                    }
                }

                if (total > 0.0)
                {
                    col /= total;
                }
                return col;
            }
            ENDCG
        }
    }
}
