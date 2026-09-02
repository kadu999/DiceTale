import { describe, it, expect } from 'vitest';
import { parseComponentData, getObjectComponent, deepCloneSnapshot } from './gameState';
import type { GameStateSnapshot, ObjectInfo } from './protocol/types';

describe('gameState', () => {
  it('parses valid component JSON', () => {
    expect(parseComponentData('[{"component":"Health","data":{"value":10}}]')).toEqual([
      { component: 'Health', data: { value: 10 } },
    ]);
  });

  it('returns null for invalid component JSON', () => {
    expect(parseComponentData('not json')).toBeNull();
  });

  it('returns null for non-array JSON', () => {
    expect(parseComponentData('{"component":"Health"}')).toBeNull();
  });

  it('filters invalid component entries', () => {
    expect(parseComponentData('[{"component":"Health","data":{"value":10}},{"invalid":true}]')).toEqual([
      { component: 'Health', data: { value: 10 } },
    ]);
  });

  it('parses nested JSON string data from server snapshot', () => {
    const input = JSON.stringify([
      { component: 'Health', displayName: '生命', data: JSON.stringify({ value: 10 }) },
    ]);
    expect(parseComponentData(input)).toEqual([{ component: 'Health', displayName: '生命', data: { value: 10 } }]);
  });

  it('parses already-parsed component array from WebSocket message', () => {
    const input = [
      { component: 'Health', displayName: '生命', data: JSON.stringify({ value: 10 }) },
    ];
    expect(parseComponentData(input)).toEqual([{ component: 'Health', displayName: '生命', data: { value: 10 } }]);
  });

  it('finds component by type', () => {
    const objects: Record<string, ObjectInfo> = {
      o1: {
        objectId: 'o1',
        componentData: '[{"component":"Health","data":{"value":10}}]',
      },
    };
    expect(getObjectComponent(objects, 'o1', 'Health')?.data.value).toBe(10);
  });

  it('returns undefined for missing object', () => {
    expect(getObjectComponent({}, 'o1', 'Health')).toBeUndefined();
  });

  it('returns undefined for missing componentData', () => {
    const objects: Record<string, ObjectInfo> = {
      o1: { objectId: 'o1' },
    };
    expect(getObjectComponent(objects, 'o1', 'Health')).toBeUndefined();
  });

  it('deep clones snapshot', () => {
    const snapshot: GameStateSnapshot = {
      currentMap: 'Map001',
      players: {
        p1: { playerId: 'p1', name: 'Alice', mapName: 'Map001', position: { x: 0.5, y: 0.5 } },
      },
      objects: {},
      spawnPoints: {},
    };
    const clone = deepCloneSnapshot(snapshot);
    expect(clone).toEqual(snapshot);
    clone.players.p1.position.x = 0.9;
    expect(snapshot.players.p1.position.x).toBe(0.5);
  });
});
