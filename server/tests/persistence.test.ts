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

  test('saveState and loadState roundtrip', (done) => {
    const state = new GameState();
    state.setMap('Map002');
    state.setPlayerPosition({ x: 3, y: 4 });
    state.registerDoors('Map002', [
      { id: 'D1', targetMap: 'Map003', targetSpawn: 'Default', isPortal: true },
    ]);
    state.setDoorUnlocked('D1', true);
    state.registerSpawnPoints('Map002', [{ id: 'Default' }, { id: 'North' }]);

    saveState(state);

    setTimeout(() => {
      const raw = fs.readFileSync(TEST_STATE_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      expect(parsed.currentMap).toBe('Map002');
      expect(parsed.player.position).toEqual({ x: 3, y: 4 });
      expect(parsed.doors['D1'].unlocked).toBe(true);
      expect(parsed.spawnPoints['Map002']).toEqual([{ id: 'Default' }, { id: 'North' }]);

      const loaded = new GameState();
      loadState(loaded);
      expect(loaded.currentMap).toBe('Map002');
      expect(loaded.player.position).toEqual({ x: 3, y: 4 });
      expect(loaded.doors['D1'].unlocked).toBe(true);
      expect(loaded.spawnPoints['Map002']).toEqual([{ id: 'Default' }, { id: 'North' }]);
      done();
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
