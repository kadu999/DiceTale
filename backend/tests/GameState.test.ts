import { GameState } from '../src/GameState';

describe('GameState', () => {
  let state: GameState;

  beforeEach(() => {
    state = new GameState();
  });

  test('registerDoors preserves unlocked state across reloads', () => {
    state.registerDoors('Map001', [
      { id: 'D1', targetMap: 'Map002', targetSpawn: 'Default', isPortal: true },
    ]);
    state.setDoorUnlocked('D1', true);

    state.registerDoors('Map001', [
      { id: 'D1', targetMap: 'Map002', targetSpawn: 'Default', isPortal: true },
    ]);

    expect(state.doors['D1'].unlocked).toBe(true);
  });

  test('registerDoors preserves unlocked state across maps (global door id)', () => {
    state.registerDoors('Map001', [
      { id: 'D1', targetMap: 'Map002', targetSpawn: 'Default', isPortal: true },
    ]);
    state.setDoorUnlocked('D1', true);

    state.setMap('Map002');
    state.registerDoors('Map002', [
      { id: 'D1', targetMap: 'Map003', targetSpawn: 'North', isPortal: true },
    ]);

    expect(state.doors['D1'].unlocked).toBe(true);
    expect(state.doors['D1'].targetMap).toBe('Map003');
    expect(state.doors['D1'].targetSpawn).toBe('North');
  });

  test('registerDoors refreshes metadata while keeping unlocked', () => {
    state.registerDoors('Map001', [
      { id: 'D1', targetMap: 'Map002', targetSpawn: 'Default', isPortal: true },
    ]);
    state.setDoorUnlocked('D1', true);

    state.registerDoors('Map001', [
      { id: 'D1', targetMap: 'Map009', targetSpawn: 'Side', isPortal: false },
    ]);

    expect(state.doors['D1'].unlocked).toBe(true);
    expect(state.doors['D1'].targetMap).toBe('Map009');
    expect(state.doors['D1'].isPortal).toBe(false);
  });

  test('setDoorUnlocked returns false for unknown door', () => {
    expect(state.setDoorUnlocked('Missing')).toBe(false);
  });

  test('getSnapshot returns deep copy', () => {
    state.setMap('Map002');
    state.setPlayerPosition('Player_1', { x: 1, y: 2 }, 'Map002');
    state.registerDoors('Map002', [
      { id: 'D2', targetMap: 'Map003', targetSpawn: 'Default', isPortal: false },
    ]);
    state.setDoorUnlocked('D2', true);
    state.registerSpawnPoints('Map002', [{ id: 'Default' }, { id: 'North' }]);

    const snapshot = state.getSnapshot();
    expect(snapshot.currentMap).toBe('Map002');
    expect(snapshot.players['Player_1'].position).toEqual({ x: 1, y: 2 });
    expect(snapshot.doors['D2'].unlocked).toBe(true);
    expect(snapshot.spawnPoints['Map002']).toEqual([{ id: 'Default' }, { id: 'North' }]);

    snapshot.players['Player_1'].position.x = 999;
    snapshot.doors['D2'].unlocked = false;
    snapshot.spawnPoints['Map002'][0].id = 'Hacked';
    expect(state.players['Player_1'].position.x).toBe(1);
    expect(state.doors['D2'].unlocked).toBe(true);
    expect(state.spawnPoints['Map002'][0].id).toBe('Default');
  });
});
