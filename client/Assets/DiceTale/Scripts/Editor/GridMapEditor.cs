using UnityEditor;
using UnityEngine;

namespace DiceTale.Editor
{
    [CustomEditor(typeof(GridMap))]
    public class GridMapEditor : UnityEditor.Editor
    {
        private GridMap gridMap;

        private void OnEnable()
        {
            gridMap = target as GridMap;
        }

        public override void OnInspectorGUI()
        {
            serializedObject.Update();

            EditorGUILayout.PropertyField(serializedObject.FindProperty("gridSize"));
            EditorGUILayout.PropertyField(serializedObject.FindProperty("autoCellSize"));

            var cellSizeProperty = serializedObject.FindProperty("cellSize");
            var autoCellSizeProperty = serializedObject.FindProperty("autoCellSize");
            if (!autoCellSizeProperty.boolValue)
            {
                EditorGUILayout.PropertyField(cellSizeProperty);
            }
            else
            {
                EditorGUI.BeginDisabledGroup(true);
                EditorGUILayout.PropertyField(cellSizeProperty);
                EditorGUI.EndDisabledGroup();
            }

            EditorGUILayout.PropertyField(serializedObject.FindProperty("brushSize"));
            EditorGUILayout.PropertyField(serializedObject.FindProperty("drawBlockedCells"));

            serializedObject.ApplyModifiedProperties();

            EditorGUILayout.Space();

            if (GUILayout.Button("Open Grid Editor", GUILayout.Height(40f)))
            {
                GridMapEditorWindow.Open(gridMap);
            }

            EditorGUILayout.Space();

            if (GUILayout.Button("Save Grid Data"))
            {
                gridMap.SaveData();
            }

            if (GUILayout.Button("Load Grid Data"))
            {
                gridMap.LoadData();
            }
        }
    }
}
