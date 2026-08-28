import { GameState } from '../src/GameState';

describe('GameState', () => {
  let state: GameState;

  beforeEach(() => {
    state = new GameState();
  });

  test('registerObjects stores name/kind/currentState/states/position/items per object', () => {
    state.registerObjects('Map001', [
      { id: 'Lever_1', name: '大厅拉杆', kind: 'Lever', currentState: 'off', states: ['off', 'on'], position: { x: 0.4, y: 0.3 }, items: ['扳手'] },
    ]);

    expect(state.objects['Lever_1']).toEqual({
      name: '大厅拉杆',
      kind: 'Lever',
      currentState: 'off',
      states: ['off', 'on'],
      mapName: 'Map001',
      position: { x: 0.4, y: 0.3 },
      items: ['扳手'],
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

  test('registerObjects stores itemName/quantity when provided, omits otherwise', () => {
    state.registerObjects('Map001', [
      { id: 'Item_1', kind: 'ItemObject', name: '铁剑 ×3', itemName: '铁剑', quantity: 3 },
      { id: 'Door_1', kind: 'Door' },
    ]);

    expect(state.objects['Item_1'].itemName).toBe('铁剑');
    expect(state.objects['Item_1'].quantity).toBe(3);
    expect(state.objects['Door_1'].itemName).toBeUndefined();
    expect(state.objects['Door_1'].quantity).toBeUndefined();
  });

  test('registerObjects stores components list when provided, omits otherwise', () => {
    state.registerObjects('Map001', [
      { id: 'Door_1', kind: 'SceneObject', components: ['SceneObject', 'ItemInventory'] },
      { id: 'Plain_1', kind: 'SceneObject' },
    ]);

    expect(state.objects['Door_1'].components).toEqual(['SceneObject', 'ItemInventory']);
    expect(state.objects['Plain_1'].components).toBeUndefined();
  });

  test('registerObjects replaces previous objects and honors client mapName (no cross-map bleed)', () => {
    state.registerObjects('Map001', [
      { id: 'Door', name: '大门', kind: 'Door', mapName: 'Map001' },
    ]);

    // 切到 Map002：同 ID 对象带上客户端上报的 mapName，未再上报的旧对象被整体替换移除
    state.registerObjects('Map002', [
      { id: 'Door', name: '大门', kind: 'Door', mapName: 'Map002' },
      { id: 'Chest', name: '宝箱', kind: 'Chest', mapName: 'Map002' },
    ]);

    expect(state.objects['Door'].mapName).toBe('Map002');
    expect(state.objects['Chest'].mapName).toBe('Map002');
    expect(Object.keys(state.objects).sort()).toEqual(['Chest', 'Door']); // 旧地图对象已移除
  });

  test('registerObjects keeps items and setObjectItems updates them', () => {
    state.registerObjects('Map001', [{ id: 'Lever_1', kind: 'Lever', items: ['小刀'] }]);
    expect(state.objects['Lever_1'].items).toEqual(['小刀']);

    // 未上报 items 时保留已有物品
    state.registerObjects('Map001', [{ id: 'Lever_1', kind: 'Lever' }]);
    expect(state.objects['Lever_1'].items).toEqual(['小刀']);

    expect(state.setObjectItems('Lever_1', ['钥匙', '药水'])).toBe(true);
    expect(state.objects['Lever_1'].items).toEqual(['钥匙', '药水']);

    expect(state.setObjectItems('Missing', ['x'])).toBe(false);
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
