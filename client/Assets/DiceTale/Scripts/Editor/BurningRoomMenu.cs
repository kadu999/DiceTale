#if UNITY_EDITOR
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEngine;

namespace DiceTale.Editor
{
    /// <summary>
    /// BurningRoom 的编辑器辅助菜单：
    /// - 把 BurningRoom 挂到选中物体（纯参数驱动，不需要 SpriteRenderer；
    ///   若选中物体带 SpriteRenderer，自动按 bounds 填好房间尺寸参数）；
    /// - 在当前场景创建带 BurningRoom 的测试房间。
    /// </summary>
    public static class BurningRoomMenu
    {
        [MenuItem("DiceTale/Burning Room/挂到选中物体")]
        public static void AttachToSelection()
        {
            var any = false;
            foreach (var go in Selection.gameObjects)
            {
                var br = go.GetComponent<BurningRoom>();
                if (br == null)
                {
                    br = go.AddComponent<BurningRoom>();
                }

                // 有 SpriteRenderer 时按 bounds 自动填房间尺寸，让墙线与房间对齐
                var sr = go.GetComponent<SpriteRenderer>() ?? go.GetComponentInChildren<SpriteRenderer>();
                if (sr != null && sr.sprite != null)
                {
                    br.RoomWidth = sr.bounds.size.x;
                    br.RoomHeight = sr.bounds.size.y;
                }

                any = true;
                Debug.Log($"[BurningRoom] 已挂到 {go.name}（激活该物体即播放；房间尺寸=" +
                          $"{br.RoomWidth:F2}x{br.RoomHeight:F2}）", go);
            }

            if (!any)
            {
                Debug.LogWarning("[BurningRoom] 未选中任何物体");
            }
        }

        [MenuItem("DiceTale/Burning Room/烘焙焦痕贴图到 Resources")]
        public static void BakeCharTexture()
        {
            var tex = BurningRoom.GenerateCharTexture();
            var png = tex.EncodeToPNG();
            Object.DestroyImmediate(tex);
            File.WriteAllBytes(BurningRoom.CharTexAssetPath, png);
            AssetDatabase.ImportAsset(BurningRoom.CharTexAssetPath, ImportAssetOptions.ForceUpdate);

            var importer = AssetImporter.GetAtPath(BurningRoom.CharTexAssetPath) as TextureImporter;
            if (importer != null)
            {
                importer.textureType = TextureImporterType.Default;
                importer.wrapMode = TextureWrapMode.Repeat;
                importer.filterMode = FilterMode.Bilinear;
                importer.mipmapEnabled = false;
                importer.sRGBTexture = true;
                importer.SaveAndReimport();
            }

            Debug.Log($"[BurningRoom] 焦痕贴图已生成: {BurningRoom.CharTexAssetPath}");
        }

        [MenuItem("DiceTale/Burning Room/创建测试房间 (当前场景)")]
        public static void CreateTestRoom()
        {
            const string texturePath = "Assets/DiceTale/Res/Textures/Room001.png";
            // Room001.png 是 Multiple 模式图集（子精灵），用 LoadAllAssetsAtPath 取精灵
            var sprites = AssetDatabase.LoadAllAssetsAtPath(texturePath).OfType<Sprite>().ToArray();
            var sprite = sprites.FirstOrDefault(s => s.name == "Room001")
                         ?? (sprites.Length > 0 ? sprites[0] : null);

            var go = new GameObject("BurningTestRoom");
            go.transform.position = Vector3.zero;
            go.transform.localScale = Vector3.one * 0.6f;

            var br = go.AddComponent<BurningRoom>();
            if (sprite != null)
            {
                var sr = go.AddComponent<SpriteRenderer>();
                sr.sprite = sprite;
                // 用精灵实际尺寸填房间参数，火焰/烧痕与房间贴图对齐
                br.RoomWidth = sr.bounds.size.x;
                br.RoomHeight = sr.bounds.size.y;
            }
            else
            {
                Debug.LogWarning("[BurningRoom] 未找到 Room001 精灵，测试房间没有贴图（仍可看到火焰/烧痕）");
            }

            Selection.activeGameObject = go;
            Debug.Log($"[BurningRoom] 已创建测试房间 BurningTestRoom（{br.RoomWidth:F2}x{br.RoomHeight:F2}），" +
                      "选中后按 Play 即可看到效果", go);
        }
    }
}
#endif
