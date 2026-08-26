import fs from 'fs';
import path from 'path';
import { parseGrid, serializeGrid, loadGrid, saveGrid, gridFilePath } from '../src/gridData';

describe('gridData', () => {
  const testName = 'TestGridA';

  afterEach(() => {
    const file = gridFilePath(testName);
    if (fs.existsSync(file)) fs.unlinkSync(file);
  });

  test('parseGrid reads Unity binary format (64x36 Map001)', () => {
    const source = path.join(__dirname, '..', '..', 'client', 'Assets', 'DiceTale', 'Resources', 'Map001.bytes');
    expect(fs.existsSync(source)).toBe(true);

    const grid = parseGrid(fs.readFileSync(source));
    expect(grid).not.toBeNull();
    expect(grid!.gridSizeX).toBe(64);
    expect(grid!.gridSizeY).toBe(36);
    expect(grid!.cells).toHaveLength(64 * 36);
    expect(grid!.cells.every((m) => [0, 1, 2, 4].includes(m))).toBe(true);
  });

  test('parseGrid rejects truncated or invalid data', () => {
    expect(parseGrid(Buffer.alloc(4))).toBeNull();
    expect(parseGrid(Buffer.alloc(100))).toBeNull(); // 长度不匹配
    const bad = serializeGrid({ gridSizeX: 2, gridSizeY: 2, cells: [0, 1, 0, 99] });
    expect(parseGrid(bad)).toBeNull(); // 非法掩码
  });

  test('serializeGrid/parseGrid roundtrip', () => {
    const data = { gridSizeX: 4, gridSizeY: 3, cells: [0, 1, 2, 4, 0, 0, 1, 1, 1, 0, 0, 0] };
    const parsed = parseGrid(serializeGrid(data));
    expect(parsed).toEqual(data);
  });

  test('saveGrid/loadGrid roundtrip', () => {
    const data = { gridSizeX: 2, gridSizeY: 2, cells: [1, 0, 0, 4] };
    expect(saveGrid(testName, data)).toBe(true);
    expect(loadGrid(testName)).toEqual(data);
  });

  test('saveGrid rejects invalid input', () => {
    expect(saveGrid(testName, { gridSizeX: 0, gridSizeY: 2, cells: [] })).toBe(false);
    expect(saveGrid(testName, { gridSizeX: 2, gridSizeY: 2, cells: [1, 0] })).toBe(false); // 数量不匹配
    expect(saveGrid('bad/name', { gridSizeX: 2, gridSizeY: 2, cells: [0, 0, 0, 0] })).toBe(false);
  });
});
