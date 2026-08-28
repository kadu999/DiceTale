using System;
using UnityEditor;
using UnityEngine;

namespace DiceTale.Editor
{
    /// <summary>
    /// 一次性迁移脚本（BackendObject 继承模型 → 组件模型）：
    /// 旧模型：SceneObject/ItemObject/MaskObject/Player/SpawnPoint 都继承 BackendObject。
    /// 新模型：BackendObject 是枢纽组件，能力组件（保留类名、保留序列化字段、GUID 不变）实现接口挂在同一物体上。
    ///
    /// 迁移内容（纯增量，不丢数据、不改 GUID）：
    /// - 为每个含旧能力组件的 GameObject 添加 BackendObject 枢纽；
    /// - 枢纽 objectKind 填旧类名（GM 页面显示的对象类型不变）；
    /// - ItemObject/MaskObject 勾选 generateUniqueId（保持旧行为：对象 ID 运行时唯一生成）；
    /// - Player 所在物体补挂 ItemInventory（旧实现玩家物品列表来自 SceneObject 继承，现已拆分到物品组件）。
    ///
    /// 菜单：DiceTale &gt; Migrate Backend Composition。幂等，可重复执行。
    /// </summary>
    public static class MigrateBackendComposition
    {
        private static readonly Type[] LegacyComponents =
        {
            typeof(SceneObject),
            typeof(ItemObject),
            typeof(MaskObject),
            typeof(Player),
            typeof(SpawnPoint),
        };

        [MenuItem("DiceTale/Migrate Backend Composition")]
        public static void Migrate()
        {
            var prefabGuids = AssetDatabase.FindAssets("t:Prefab", new[] { "Assets/DiceTale" });
            var migratedPrefabs = 0;
            var migratedObjects = 0;

            foreach (var guid in prefabGuids)
            {
                var path = AssetDatabase.GUIDToAssetPath(guid);
                var root = PrefabUtility.LoadPrefabContents(path);
                try
                {
                    var changed = MigrateGameObjectTree(root);
                    if (changed > 0)
                    {
                        PrefabUtility.SaveAsPrefabAsset(root, path);
                        migratedPrefabs++;
                        migratedObjects += changed;
                        Debug.Log($"[MigrateBackendComposition] {path}: {changed} GameObject(s) migrated.");
                    }
                }
                finally
                {
                    PrefabUtility.UnloadPrefabContents(root);
                }
            }

            Debug.Log($"[MigrateBackendComposition] Done: {migratedPrefabs} prefab(s), {migratedObjects} object(s) migrated. " +
                      "请在 Console 确认无编译错误后，打开场景运行验证（场景内未发现旧组件引用，本次未改动场景）。");
        }

        private static int MigrateGameObjectTree(GameObject root)
        {
            var changed = 0;
            foreach (var t in root.GetComponentsInChildren<Transform>(true))
            {
                if (MigrateGameObject(t.gameObject))
                {
                    changed++;
                }
            }

            return changed;
        }

        private static bool MigrateGameObject(GameObject go)
        {
            Component legacy = null;
            foreach (var type in LegacyComponents)
            {
                var comp = go.GetComponent(type);
                if (comp != null)
                {
                    legacy = comp;
                    break;
                }
            }

            if (legacy == null)
            {
                return false;
            }

            // 1. 添加枢纽（幂等：已有时跳过）
            var hub = go.GetComponent<BackendObject>();
            if (hub == null)
            {
                hub = go.AddComponent<BackendObject>();
            }

            // 2. objectKind 填旧类名（GM 页面显示的类型不变）；ItemObject/MaskObject 保持唯一 ID 行为
            var so = new SerializedObject(hub);
            var kindProp = so.FindProperty("objectKind");
            if (kindProp != null && string.IsNullOrEmpty(kindProp.stringValue))
            {
                kindProp.stringValue = legacy.GetType().Name;
            }

            if (go.GetComponent<ItemObject>() != null || go.GetComponent<MaskObject>() != null)
            {
                var uniqueProp = so.FindProperty("generateUniqueId");
                if (uniqueProp != null)
                {
                    uniqueProp.boolValue = true;
                }
            }

            so.ApplyModifiedPropertiesWithoutUndo();

            // 3. 玩家补挂物品组件（旧实现物品列表来自 SceneObject 继承，现已拆分到 ItemInventory）
            if (go.GetComponent<Player>() != null && go.GetComponent<ItemInventory>() == null)
            {
                go.AddComponent<ItemInventory>();
            }

            return true;
        }
    }
}
