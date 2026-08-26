using UnityEditor;
using UnityEngine;

namespace DiceTale.Editor
{
    public class GridMapEditorWindow : EditorWindow
    {
        private GridMapEditorState state;
        private GridMapEditorRenderer renderer;
        private Vector2 scrollPosition;

        [MenuItem("DiceTale/GridMap Editor")]
        public static void ShowWindow()
        {
            GetWindow<GridMapEditorWindow>("GridMap Editor");
        }

        private void OnEnable()
        {
            renderer = new GridMapEditorRenderer();
            state = CreateInstance<GridMapEditorState>();
            state.hideFlags = HideFlags.HideAndDontSave;
        }

        private void OnGUI()
        {
            renderer.DrawToolbar(
                state,
                out var shouldLoadTexture,
                out var shouldSave,
                out var shouldLoad,
                out var shouldClear,
                out var shouldCalculateGridSize);
            renderer.DrawInfo(state);
            scrollPosition = renderer.DrawGrid(state, scrollPosition, position.size, out var gridRect);

            if (shouldLoadTexture)
            {
                state.LoadReferenceTexture();
            }
            if (shouldSave)
            {
                state.SaveData();
            }
            if (shouldLoad)
            {
                state.LoadData();
            }
            if (shouldClear)
            {
                if (EditorUtility.DisplayDialog("确认清空", "确定要清空所有格子吗？", "确定", "取消"))
                {
                    state.Clear();
                }
            }
            if (shouldCalculateGridSize)
            {
                state.CalculateGridSizeFromImage();
            }

            HandleInput(gridRect);
        }

        private void HandleInput(Rect gridRect)
        {
            var e = Event.current;
            if (e == null)
            {
                return;
            }

            if (e.type != EventType.MouseDown && e.type != EventType.MouseDrag)
            {
                return;
            }

            if (!GridMapEditorRenderer.TryGetGridPos(gridRect, e.mousePosition, state.GridSize, out var gridPos))
            {
                return;
            }

            if (e.button == 0)
            {
                if (state.EraseMode)
                {
                    state.Erase(gridPos);
                }
                else
                {
                    state.Paint(gridPos);
                }
                e.Use();
            }
        }
    }
}
