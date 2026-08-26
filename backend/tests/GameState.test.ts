import { GameState } from '../src/GameState';

describe('GameState', () => {
  let state: GameState;

  beforeEach(() => {
    state = new GameState();
  });

  test('registerObjects stores name/kind/currentState/states/position per object', () => {
    state.registerObjects('Map001', [
      { id: 'Lever_1', name: '大厅拉杆', kind: 'Lever', currentState: 'off', states: ['off', 'on'], position: { x: 0.4, y: 0.3 } },
    ]);

    expect(state.objects['Lever_1']).toEqual({
      name: '大厅拉杆',
      kind: 'Lever',
      currentState: 'off',
      states: ['off', 'on'],
      mapName: 'Map001',
      position: { x: 0.4, y: 0.3 },
    });
  });

  test('registerObjects falls back to id when name is missing', () => {
    state.registerObjects('Map001', [{ id: 'Lever_1', kind: 'Lever' }]);
    expect(state.objects['Lever_1'].name).toBe('Lever_1');
    expect(state.objects['Lever_1'].position).toBeNull();
  });

  test('registerObjects keeps existing fields when re-registered without them', () => {
    state.registerObjects('Map001', [
      { id: 'Lever_1', name: '大厅拉杆', kind: 'Lever', currentState: 'off', states: ['off', 'on'] },
    ]);
    state.setObjectState('Lever_1', 'on');

    state.registerObjects('Map001', [{ id: 'Lever_1', kind: 'Lever' }]);

    expect(state.objects['Lever_1'].name).toBe('大厅拉杆');
    expect(state.objects['Lever_1'].currentState).toBe('on');
    expect(state.objects['Lever_1'].states).toEqual(['off', 'on']);
  });

  test('setObjectState updates currentState and returns false for unknown object', () => {
    state.registerObjects('Map001', [{ id: 'Lever_1', kind: 'Lever', states: ['off', 'on'] }]);

    expect(state.setObjectState('Lever_1', 'on')).toBe(true);
    expect(state.objects['Lever_1'].currentState).toBe('on');
    expect(state.setObjectState('Missing', 'on')).toBe(false);
  });

  test('clearClientData clears players, objects and spawnPoints', () => {
    state.registerPlayers([{ id: 'Player_1', name: '小明' }]);
    state.registerSpawnPoints('Map001', [{ id: 'Default' }]);
    state.registerObjects('Map001', [{ id: 'Lever_1', kind: 'Lever', currentState: 'off' }]);
    state.setPlayerPosition('Player_1', { x: 0.5, y: 0.5 }, 'Map001');

    state.clearClientData();

    expect(state.players).toEqual({});
    expect(state.objects).toEqual({});
    expect(state.spawnPoints).toEqual({});
    // currentMap 由后台/GM 维护，不随客户端断开清空
    expect(state.currentMap).toBe('Map001');
  });

  test('getSnapshot returns deep copy', () => {
    state.setMap('Map002');
    state.setPlayerPosition('Player_1', { x: 1, y: 2 }, 'Map002');
    state.registerSpawnPoints('Map002', [{ id: 'Default' }, { id: 'North' }]);
    state.registerObjects('Map002', [
      { id: 'Lever_1', kind: 'Lever', currentState: 'off', states: ['off', 'on'] },
    ]);

    const snapshot = state.getSnapshot();
    expect(snapshot.currentMap).toBe('Map002');
    expect(snapshot.players['Player_1'].position).toEqual({ x: 1, y: 2 });
    expect(snapshot.spawnPoints['Map002']).toEqual([{ id: 'Default' }, { id: 'North' }]);
    expect(snapshot.objects['Lever_1'].currentState).toBe('off');

    snapshot.players['Player_1'].position.x = 999;
    snapshot.spawnPoints['Map002'][0].id = 'Hacked';
    snapshot.objects['Lever_1'].currentState = 'on';
    expect(state.players['Player_1'].position.x).toBe(1);
    expect(state.spawnPoints['Map002'][0].id).toBe('Default');
    expect(state.objects['Lever_1'].currentState).toBe('off');
  });
});
