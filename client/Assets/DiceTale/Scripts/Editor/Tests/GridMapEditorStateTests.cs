using System.Collections.Generic;
using System.IO;
using DiceTale;
using NUnit.Framework;
using UnityEditor;
using UnityEngine;

namespace DiceTale.Editor.Tests
{
    public class GridMapEditorStateTests
    {
        private GameObject _cleanupGameObject;
        private string _cleanupFilePath;

        [TearDown]
        public void TearDown()
        {
            if (_cleanupGameObject != null)
            {
                Object.DestroyImmediate(_cleanupGameObject);
                _cleanupGameObject = null;
            }

            if (!string.IsNullOrEmpty(_cleanupFilePath) && File.Exists(_cleanupFilePath))
            {
                File.Delete(_cleanupFilePath);
                _cleanupFilePath = null;
            }
        }

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

        [Test]
        public void Clear_RemovesAllCells()
        {
            var state = ScriptableObject.CreateInstance<GridMapEditorState>();
            state.GridSize = new Vector2Int(5, 5);
            state.BrushSize = 1;
            state.SelectedType = GridCellType.Obstacle;
            state.Paint(new Vector2Int(1, 1));
            state.Paint(new Vector2Int(2, 2));
            state.Paint(new Vector2Int(3, 3));

            state.Clear();

            Assert.AreEqual(0, state.CellTypes.Count);
        }

        [Test]
        public void GridSize_IsClampedToAtLeastOne()
        {
            var state = ScriptableObject.CreateInstance<GridMapEditorState>();
            state.GridSize = new Vector2Int(0, -3);
            Assert.AreEqual(Vector2Int.one, state.GridSize);
        }

        [Test]
        public void BrushSize_IsClampedToConstants()
        {
            var state = ScriptableObject.CreateInstance<GridMapEditorState>();
            state.BrushSize = 0;
            Assert.AreEqual(GridMapEditorConstants.MinBrushSize, state.BrushSize);
            state.BrushSize = 100;
            Assert.AreEqual(GridMapEditorConstants.MaxBrushSize, state.BrushSize);
        }

        [Test]
        public void SaveData_AndRuntimeGridMap_LoadData_Match()
        {
            var state = ScriptableObject.CreateInstance<GridMapEditorState>();
            state.MapName = "TestMap";
            state.GridSize = new Vector2Int(5, 5);
            state.BrushSize = 1;
            state.SelectedType = GridCellType.Difficult;
            state.Paint(new Vector2Int(1, 1));
            state.SelectedType = GridCellType.Water;
            state.Paint(new Vector2Int(2, 2));

            state.SaveData();

            _cleanupGameObject = new GameObject("TestMap");
            var gridMap = _cleanupGameObject.AddComponent<GridMap>();
            gridMap.LoadData("TestMap");

            _cleanupFilePath = Path.Combine(Application.dataPath, "DiceTale/Resources/TestMap.bytes");

            Assert.AreEqual(GridCellType.Difficult, gridMap.GetCellType(new Vector2Int(1, 1)));
            Assert.AreEqual(GridCellType.Water, gridMap.GetCellType(new Vector2Int(2, 2)));
            Assert.AreEqual(GridCellType.Empty, gridMap.GetCellType(new Vector2Int(0, 0)));
        }

        [Test]
        public void Paint_PerformUndo_RevertsDictionary()
        {
            var state = ScriptableObject.CreateInstance<GridMapEditorState>();
            state.GridSize = new Vector2Int(5, 5);
            state.BrushSize = 1;
            state.SelectedType = GridCellType.Obstacle;

            state.Paint(new Vector2Int(2, 2));
            Assert.AreEqual(1, state.CellTypes.Count);

            Undo.PerformUndo();
            Assert.AreEqual(0, state.CellTypes.Count);
        }

        [Test]
        public void LoadData_WithEmptyMapName_LeavesExistingCellsIntact()
        {
            var state = ScriptableObject.CreateInstance<GridMapEditorState>();
            state.GridSize = new Vector2Int(5, 5);
            state.MapName = "";
            state.BrushSize = 1;
            state.SelectedType = GridCellType.Obstacle;
            state.Paint(new Vector2Int(2, 2));

            state.LoadData();

            Assert.AreEqual(1, state.CellTypes.Count);
            Assert.IsTrue(state.CellTypes.ContainsKey(new Vector2Int(2, 2)));
        }
    }
}
