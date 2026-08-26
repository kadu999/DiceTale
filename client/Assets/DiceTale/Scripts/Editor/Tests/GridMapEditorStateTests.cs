using System.Collections.Generic;
using DiceTale;
using NUnit.Framework;
using UnityEngine;

namespace DiceTale.Editor.Tests
{
    public class GridMapEditorStateTests
    {
        [Test]
        public void Paint_WithBrushSize1_PaintsSingleCenterCell()
        {
            var state = ScriptableObject.CreateInstance<GridMapEditorState>();
            state.GridSize = new Vector2Int(5, 5);
            state.BrushSize = 1;
            state.SelectedType = GridCellType.Obstacle;

            state.Paint(new Vector2Int(2, 2));

            Assert.AreEqual(1, state.CellTypes.Count);
            Assert.IsTrue(state.CellTypes.ContainsKey(new Vector2Int(2, 2)));
            Assert.AreEqual(GridCellType.Obstacle, state.CellTypes[new Vector2Int(2, 2)]);
        }

        [Test]
        public void Paint_WithBrushSize3_Paints3x3CenteredCells()
        {
            var state = ScriptableObject.CreateInstance<GridMapEditorState>();
            state.GridSize = new Vector2Int(10, 10);
            state.BrushSize = 3;
            state.SelectedType = GridCellType.Obstacle;

            state.Paint(new Vector2Int(5, 5));

            Assert.AreEqual(9, state.CellTypes.Count);
            for (int x = 4; x <= 6; x++)
            {
                for (int y = 4; y <= 6; y++)
                {
                    Assert.IsTrue(state.CellTypes.ContainsKey(new Vector2Int(x, y)));
                }
            }
        }

        [Test]
        public void Paint_OutOfBounds_IsIgnored()
        {
            var state = ScriptableObject.CreateInstance<GridMapEditorState>();
            state.GridSize = new Vector2Int(5, 5);
            state.BrushSize = 1;
            state.SelectedType = GridCellType.Obstacle;

            state.Paint(new Vector2Int(-1, -1));

            Assert.AreEqual(0, state.CellTypes.Count);
        }

        [Test]
        public void Erase_RemovesCells()
        {
            var state = ScriptableObject.CreateInstance<GridMapEditorState>();
            state.GridSize = new Vector2Int(5, 5);
            state.BrushSize = 1;
            state.SelectedType = GridCellType.Obstacle;
            state.Paint(new Vector2Int(2, 2));

            state.Erase(new Vector2Int(2, 2));

            Assert.AreEqual(0, state.CellTypes.Count);
        }
    }
}
