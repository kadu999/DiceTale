import fs from 'fs';
import path from 'path';
import { GameState } from '../src/GameState';
import { loadState, saveState } from '../src/persistence';

const TEST_STATE_FILE = path.join(__dirname, '..', 'data', 'gamestate.json');

describe('persistence', () => {
  beforeEach(() => {
    if (fs.existsSync(TEST_STATE_FILE)) fs.unlinkSync(TEST_STATE_FILE);
  });

  afterAll(() => {
    if (fs.existsSync(TEST_STATE_FILE)) fs.unlinkSync(TEST_STATE_FILE);
  });

  test('saveState and loadState roundtrip (doorUnlocked only)', (done) => {
    const state = new GameState();
    state.registerDoors('Map002', [
      { id: 'D1', targetMap: 'Map003', targetSpawn: 'Default', isPortal: true },
    ]);
    state.setDoorUnlocked('D1', true);

    saveState(state);

    setTimeout(() => {
      const raw = fs.readFileSync(TEST_STATE_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      expect(parsed.doorUnlocked).toEqual({ D1: true });
      // 门本体/地图等运行时数据不持久化
      expect(parsed.doors).toBeUndefined();
      expect(parsed.currentMap).toBeUndefined();

      const loaded = new GameState();
      loadState(loaded);
      expect(loaded.doorUnlocked).toEqual({ D1: true });
      done();
    }, 500);
  });

  test('loaded doorUnlocked is merged when client re-registers doors', () => {
    const state = new GameState();
    state.registerDoors('Map002', [
      { id: 'D1', targetMap: 'Map003', targetSpawn: 'Default', isPortal: true },
    ]);
    state.setDoorUnlocked('D1', true);
    saveState(state);

    setTimeout(() => {
      const loaded = new GameState();
      loadState(loaded);
      // 客户端重新上报门（无 unlocked 字段）
      loaded.registerDoors('Map002', [
        { id: 'D1', targetMap: 'Map003', targetSpawn: 'Default', isPortal: true },
      ]);
      expect(loaded.doors['D1'].unlocked).toBe(true);
    }, 500);
  });

  test('loadState tolerates missing file', () => {
    const state = new GameState();
    expect(() => loadState(state)).not.toThrow();
    expect(state.currentMap).toBe('Map001');
  });

  test('loadState tolerates corrupt file', () => {
    fs.mkdirSync(path.dirname(TEST_STATE_FILE), { recursive: true });
    fs.writeFileSync(TEST_STATE_FILE, '{ not valid json');
    const state = new GameState();
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => loadState(state)).not.toThrow();
    errorSpy.mockRestore();
  });
});
