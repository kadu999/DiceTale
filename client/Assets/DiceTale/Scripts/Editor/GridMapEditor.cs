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
            base.OnInspectorGUI();

            EditorGUILayout.Space();
            EditorGUILayout.LabelField("Scene View 操作", EditorStyles.boldLabel);
            EditorGUILayout.LabelField("左键刷障碍", EditorStyles.label);
            EditorGUILayout.LabelField("右键清除障碍", EditorStyles.label);

            if (GUILayout.Button("Save Grid Data"))
            {
                gridMap.SaveData();
            }
        }

        private void OnSceneGUI()
        {
            if (gridMap == null)
            {
                return;
            }

            DrawGrid();
            DrawObstacles();
            HandleInput();
        }

        private void DrawGrid()
        {
            var size = gridMap.GridSize;
            var cellSize = gridMap.CellSize;
            var origin = gridMap.GridOrigin;

            Handles.color = Color.green;
            for (int x = 0; x <= size.x; x++)
            {
                var start = origin + new Vector3(x * cellSize, 0, 0);
                var end = origin + new Vector3(x * cellSize, size.y * cellSize, 0);
                Handles.DrawLine(start, end);
            }

            for (int y = 0; y <= size.y; y++)
            {
                var start = origin + new Vector3(0, y * cellSize, 0);
                var end = origin + new Vector3(size.x * cellSize, y * cellSize, 0);
                Handles.DrawLine(start, end);
            }
        }

        private void DrawObstacles()
        {
            var cellSize = gridMap.CellSize;
            var obstacles = gridMap.GetObstacles();

            Handles.color = new Color(1f, 0f, 0f, 0.5f);
            foreach (var obstacle in obstacles)
            {
                var center = gridMap.GridToWorld(obstacle);
                var half = cellSize * 0.4f;
                var verts = new Vector3[]
                {
                    center + new Vector3(-half, -half, 0),
                    center + new Vector3(-half, half, 0),
                    center + new Vector3(half, half, 0),
                    center + new Vector3(half, -half, 0)
                };
                Handles.DrawSolidRectangleWithOutline(verts, new Color(1f, 0f, 0f, 0.5f), Color.red);
            }
        }

        private void HandleInput()
        {
            var e = Event.current;
            if (e == null || (e.type != EventType.MouseDown && e.type != EventType.MouseDrag))
            {
                return;
            }

            var ray = HandleUtility.GUIPointToWorldRay(e.mousePosition);
            var worldPos = ray.origin;
            var gridPos = gridMap.WorldToGrid(worldPos);

            if (e.button == 0)
            {
                Undo.RecordObject(gridMap, "Paint Obstacle");
                gridMap.SetObstacle(gridPos, true);
                gridMap.SaveData();
                e.Use();
            }
            else if (e.button == 1)
            {
                Undo.RecordObject(gridMap, "Erase Obstacle");
                gridMap.SetObstacle(gridPos, false);
                gridMap.SaveData();
                e.Use();
            }

            EditorUtility.SetDirty(gridMap);
        }
    }
}
