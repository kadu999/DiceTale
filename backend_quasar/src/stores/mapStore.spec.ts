import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useMapStore } from './mapStore';
import { useGameStateStore } from './gameStateStore';

describe('mapStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('falls back through effective map order', () => {
    const gameState = useGameStateStore();
    const map = useMapStore();

    expect(map.effectiveMap).toBeNull();

    gameState.applySnapshot({
      currentMap: 'Map001',
      players: {},
      objects: { o1: { objectId: 'o1', mapName: 'Map002' } },
      spawnPoints: {},
    });

    expect(map.effectiveMap).toBe('Map001');

    map.selectMap('Map002');
    expect(map.effectiveMap).toBe('Map002');

    map.selectMap('Unknown');
    expect(map.effectiveMap).toBe('Map001');

    gameState.applySnapshot({
      currentMap: '',
      players: {},
      objects: { o1: { objectId: 'o1', mapName: 'Map002' } },
      spawnPoints: {},
    });
    expect(map.effectiveMap).toBe('Map002');
  });

  it('selects object id', () => {
    const map = useMapStore();
    map.selectObject('o1');
    expect(map.selectedObjectId).toBe('o1');
  });

  it('falls back to currentMap when selectedMap is not in knownMaps', () => {
    const gameState = useGameStateStore();
    gameState.applySnapshot({
      currentMap: 'Map001',
      players: {},
      objects: { o1: { objectId: 'o1', mapName: 'Map002' } },
      spawnPoints: {},
    });

    const map = useMapStore();
    map.selectMap('UnknownMap');
    expect(map.effectiveMap).toBe('Map001');
  });
});
