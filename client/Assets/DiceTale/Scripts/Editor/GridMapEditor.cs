using System.Collections.Generic;
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

            serializedObject.ApplyModifiedProperties();

            EditorGUILayout.Space();
            EditorGUILayout.LabelField("Scene View 操作", EditorStyles.boldLabel);
            EditorGUILayout.LabelField("左键刷障碍", EditorStyles.label);
            EditorGUILayout.LabelField("右键清除障碍", EditorStyles.label);
            EditorGUILayout.LabelField("拖动可连续刷", EditorStyles.label);

            if (GUILayout.Button("Save Grid Data"))
            {
                gridMap.SaveData();
            }

            if (GUILayout.Button("Load Grid Data"))
            {
                gridMap.LoadData();
            }

            if (GUILayout.Button("Clear All Obstacles"))
            {
                Undo.RecordObject(gridMap, "Clear All Obstacles");
                foreach (var obstacle in new List<Vector2Int>(gridMap.GetObstacles()))
                {
                    gridMap.SetObstacle(obstacle, false);
                }
                gridMap.SaveData();
                EditorUtility.SetDirty(gridMap);
            }
        }

        private void OnSceneGUI()
        {
            if (gridMap == null)
            {
                return;
            }

            gridMap.UpdateCellSize();

            DrawGrid();
            DrawObstacles();
            DrawBrushPreview();
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
                PaintBrush(gridPos, true);
                gridMap.SaveData();
                e.Use();
            }
            else if (e.button == 1)
            {
                Undo.RecordObject(gridMap, "Erase Obstacle");
                PaintBrush(gridPos, false);
                gridMap.SaveData();
                e.Use();
            }

            EditorUtility.SetDirty(gridMap);
        }

        private void PaintBrush(Vector2Int center, bool isObstacle)
        {
            var brushSize = gridMap.BrushSize;
            var half = brushSize / 2;
            for (int x = -half; x < brushSize - half; x++)
            {
                for (int y = -half; y < brushSize - half; y++)
                {
                    var pos = new Vector2Int(center.x + x, center.y + y);
                    gridMap.SetObstacle(pos, isObstacle);
                }
            }
        }

        private void DrawBrushPreview()
        {
            var e = Event.current;
            if (e == null)
            {
                return;
            }

            var ray = HandleUtility.GUIPointToWorldRay(e.mousePosition);
            var gridPos = gridMap.WorldToGrid(ray.origin);
            var brushSize = gridMap.BrushSize;
            var half = brushSize / 2;

            Handles.color = new Color(1f, 1f, 0f, 0.3f);
            for (int x = -half; x < brushSize - half; x++)
            {
                for (int y = -half; y < brushSize - half; y++)
                {
                    var pos = new Vector2Int(gridPos.x + x, gridPos.y + y);
                    if (pos.x < 0 || pos.x >= gridMap.GridSize.x || pos.y < 0 || pos.y >= gridMap.GridSize.y)
                    {
                        continue;
                    }

                    var center = gridMap.GridToWorld(pos);
                    var cellSize = gridMap.CellSize;
                    var halfCell = cellSize * 0.5f;
                    var verts = new Vector3[]
                    {
                        center + new Vector3(-halfCell, -halfCell, 0),
                        center + new Vector3(-halfCell, halfCell, 0),
                        center + new Vector3(halfCell, halfCell, 0),
                        center + new Vector3(halfCell, -halfCell, 0)
                    };
                    Handles.DrawSolidRectangleWithOutline(verts, new Color(1f, 1f, 0f, 0.3f), Color.yellow);
                }
            }
        }
    }
}
