import { GameState } from '../src/GameState';

// 组件数据段构造：组件类型 + JSON 字符串数据（与客户端 JsonUtility.ToJson 一致）
const sm = (currentState: string, states: string[]) => ({
  component: 'StateMachine',
  data: JSON.stringify({ currentState, states }),
});
const backpack = (items: string[]) => ({
  component: 'Backpack',
  data: JSON.stringify({ items }),
});
const exchange = (itemName: string, quantity: number) => ({
  component: 'ItemExchange',
  data: JSON.stringify({ itemName, quantity }),
});

describe('GameState', () => {
  let state: GameState;

  beforeEach(() => {
    state = new GameState();
  });

  test('registerObjects stores name/kind/position/componentData per object', () => {
    state.registerObjects('Map001', [
      {
        id: 'Lever_1',
        name: '大厅拉杆',
        kind: 'Lever',
        position: { x: 0.4, y: 0.3 },
        componentData: [sm('off', ['off', 'on']), backpack(['扳手'])],
      },
    ]);

    expect(state.objects['Lever_1']).toEqual({
      name: '大厅拉杆',
      kind: 'Lever',
      mapName: 'Map001',
      position: { x: 0.4, y: 0.3 },
      componentData: [sm('off', ['off', 'on']), backpack(['扳手'])],
    });
  });

  test('registerObjects falls back to id when name is missing', () => {
    state.registerObjects('Map001', [{ id: 'Lever_1', kind: 'Lever' }]);
    expect(state.objects['Lever_1'].name).toBe('Lever_1');
    expect(state.objects['Lever_1'].position).toBeNull();
  });

  test('registerObjects keeps existing componentData when re-registered without it', () => {
    state.registerObjects('Map001', [
      { id: 'Lever_1', name: '大厅拉杆', kind: 'Lever', componentData: [sm('off', ['off', 'on'])] },
    ]);
    state.setObjectState('Lever_1', 'on');

    state.registerObjects('Map001', [{ id: 'Lever_1', kind: 'Lever' }]);

    expect(state.objects['Lever_1'].name).toBe('大厅拉杆');
    expect(state.objects['Lever_1'].componentData).toEqual([sm('on', ['off', 'on'])]);
  });

  test('setObjectState updates StateMachine currentState; unknown/missing component returns false', () => {
    state.registerObjects('Map001', [
      { id: 'Lever_1', kind: 'Lever', componentData: [sm('off', ['off', 'on'])] },
      { id: 'Plain_1', kind: 'Lever' },
    ]);

    expect(state.setObjectState('Lever_1', 'on')).toBe(true);
    expect(state.objects['Lever_1'].componentData![0].data).toBe(JSON.stringify({ currentState: 'on', states: ['off', 'on'] }));
    expect(state.setObjectState('Plain_1', 'on')).toBe(false); // 没有 StateMachine 组件
    expect(state.setObjectState('Missing', 'on')).toBe(false);
  });

  test('registerObjects stores ItemExchange data when provided, omits otherwise', () => {
    state.registerObjects('Map001', [
      { id: 'Item_1', kind: 'Item', name: '铁剑 ×3', componentData: [exchange('铁剑', 3)] },
      { id: 'Door_1', kind: 'Door' },
    ]);

    expect(state.objects['Item_1'].componentData![0].data).toBe('{"itemName":"铁剑","quantity":3}');
    expect(state.objects['Door_1'].componentData).toBeUndefined();
  });

  test('registerObjects stores componentData list when provided, omits otherwise', () => {
    state.registerObjects('Map001', [
      { id: 'Door_1', kind: 'SceneObject', componentData: [sm('closed', ['closed', 'open']), backpack([])] },
      { id: 'Plain_1', kind: 'SceneObject' },
    ]);

    expect(state.objects['Door_1'].componentData!.map((c) => c.component)).toEqual(['StateMachine', 'Backpack']);
    expect(state.objects['Plain_1'].componentData).toBeUndefined();
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

  test('registerObjects keeps Backpack data and setObjectItems updates it', () => {
    state.registerObjects('Map001', [
      { id: 'Lever_1', kind: 'Lever', componentData: [backpack(['小刀'])] },
    ]);
    expect(state.objects['Lever_1'].componentData![0].data).toBe('{"items":["小刀"]}');

    // 未上报 componentData 时保留已有物品
    state.registerObjects('Map001', [{ id: 'Lever_1', kind: 'Lever' }]);
    expect(state.objects['Lever_1'].componentData![0].data).toBe('{"items":["小刀"]}');

    expect(state.setObjectItems('Lever_1', ['钥匙', '药水'])).toBe(true);
    expect(state.objects['Lever_1'].componentData![0].data).toBe('{"items":["钥匙","药水"]}');

    expect(state.setObjectItems('Missing', ['x'])).toBe(false);
  });

  test('setObjectFloat/Int/Bool update value component data; missing component returns false', () => {
    state.registerObjects('Map001', [
      {
        id: 'Val_1',
        kind: 'Lever',
        componentData: [
          { component: 'FloatValue', data: '{"value":0}' },
          { component: 'IntValue', data: '{"value":0}' },
          { component: 'BoolValue', data: '{"value":false}' },
        ],
      },
    ]);

    expect(state.setObjectFloat('Val_1', 1.5)).toBe(true);
    expect(state.setObjectInt('Val_1', 3)).toBe(true);
    expect(state.setObjectBool('Val_1', true)).toBe(true);

    const data = state.objects['Val_1'].componentData!;
    expect(JSON.parse(data.find((c) => c.component === 'FloatValue')!.data).value).toBe(1.5);
    expect(JSON.parse(data.find((c) => c.component === 'IntValue')!.data).value).toBe(3);
    expect(JSON.parse(data.find((c) => c.component === 'BoolValue')!.data).value).toBe(true);

    expect(state.setObjectFloat('Missing', 1)).toBe(false);
    expect(state.setObjectBool('Val_1', false)).toBe(true);
  });

  test('clearClientData clears players, objects and spawnPoints', () => {
    state.registerPlayers([{ id: 'Player_1', name: '小明' }]);
    state.registerSpawnPoints('Map001', [{ id: 'Default' }]);
    state.registerObjects('Map001', [{ id: 'Lever_1', kind: 'Lever', componentData: [sm('off', ['off', 'on'])] }]);
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
      { id: 'Lever_1', kind: 'Lever', componentData: [sm('off', ['off', 'on'])] },
    ]);

    const snapshot = state.getSnapshot();
    expect(snapshot.currentMap).toBe('Map002');
    expect(snapshot.players['Player_1'].position).toEqual({ x: 1, y: 2 });
    expect(snapshot.spawnPoints['Map002']).toEqual([{ id: 'Default' }, { id: 'North' }]);
    expect(snapshot.objects['Lever_1'].componentData).toEqual([sm('off', ['off', 'on'])]);

    snapshot.players['Player_1'].position.x = 999;
    snapshot.spawnPoints['Map002'][0].id = 'Hacked';
    snapshot.objects['Lever_1'].componentData![0].data = 'hacked';
    expect(state.players['Player_1'].position.x).toBe(1);
    expect(state.spawnPoints['Map002'][0].id).toBe('Default');
    expect(state.objects['Lever_1'].componentData![0].data).toBe(JSON.stringify({ currentState: 'off', states: ['off', 'on'] }));
  });
});
