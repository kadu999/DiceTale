using UnityEditor;

namespace DiceTale.Editor
{
    [CustomEditor(typeof(Door))]
    public class DoorEditor : UnityEditor.Editor
    {
        public override void OnInspectorGUI()
        {
            serializedObject.Update();

            EditorGUILayout.PropertyField(serializedObject.FindProperty("conditions"));
            EditorGUILayout.PropertyField(serializedObject.FindProperty("isPortal"));
            EditorGUILayout.PropertyField(serializedObject.FindProperty("blockingCollider"));

            var isPortal = serializedObject.FindProperty("isPortal");
            if (isPortal.boolValue)
            {
                EditorGUILayout.PropertyField(serializedObject.FindProperty("targetSceneName"));
                EditorGUILayout.PropertyField(serializedObject.FindProperty("targetSpawnId"));
            }
            else
            {
                EditorGUILayout.PropertyField(serializedObject.FindProperty("onUnlocked"));
            }

            serializedObject.ApplyModifiedProperties();
        }
    }
}
