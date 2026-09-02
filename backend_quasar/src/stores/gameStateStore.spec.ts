import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useGameStateStore } from './gameStateStore';

describe('gameStateStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('has an empty initial snapshot using null prototypes', () => {
    const store = useGameStateStore();
    expect(store.snapshot.currentMap).toBe('');
    expect(Object.getPrototypeOf(store.snapshot.players)).toBeNull();
    expect(Object.getPrototypeOf(store.snapshot.objects)).toBeNull();
    expect(Object.getPrototypeOf(store.snapshot.spawnPoints)).toBeNull();
    expect(store.clientConnected).toBe(false);
  });

  it('applies snapshot and exposes known maps', () => {
    const store = useGameStateStore();
    store.applySnapshot({
      currentMap: 'Map001',
      players: { p1: { playerId: 'p1', mapName: 'Map003' } },
      objects: { o1: { objectId: 'o1', mapName: 'Map002' } },
      spawnPoints: {},
    });
    expect(store.knownMaps.has('Map001')).toBe(true);
    expect(store.knownMaps.has('Map002')).toBe(true);
    expect(store.knownMaps.has('Map003')).toBe(true);
    expect(store.getObject('o1')?.mapName).toBe('Map002');
    expect(store.getPlayer('p1')?.mapName).toBe('Map003');
  });

  it('updates client connected flag', () => {
    const store = useGameStateStore();
    store.setClientConnected(true);
    expect(store.clientConnected).toBe(true);
  });

  it('includes api maps in known maps', () => {
    const store = useGameStateStore();
    store.setApiMaps([
      { name: 'Map001', image: '/maps/Map001.png' },
      { name: 'Map002', image: '/maps/Map002.png' },
    ]);
    expect(store.knownMaps.has('Map001')).toBe(true);
    expect(store.knownMaps.has('Map002')).toBe(true);
  });

  it('keeps null prototypes when applying snapshots with plain objects', () => {
    const store = useGameStateStore();
    store.applySnapshot({
      currentMap: 'Map001',
      players: { p1: { playerId: 'p1', mapName: 'Map003' } },
      objects: { o1: { objectId: 'o1', mapName: 'Map002' } },
      spawnPoints: { s1: { x: 0, y: 0 } },
    });
    expect(Object.getPrototypeOf(store.snapshot.players)).toBeNull();
    expect(Object.getPrototypeOf(store.snapshot.objects)).toBeNull();
    expect(Object.getPrototypeOf(store.snapshot.spawnPoints)).toBeNull();
    expect(store.getPlayer('p1')?.mapName).toBe('Map003');
    expect(store.getObject('o1')?.mapName).toBe('Map002');
  });
});
