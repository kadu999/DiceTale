import { describe, it, expect, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import { nextTick } from 'vue';
import MapOverlay from './MapOverlay.vue';
import { useGameStateStore } from 'src/stores/gameStateStore';
import { useMapStore } from 'src/stores/mapStore';

describe('MapOverlay', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  function positionToStyle(pos: { x: number; y: number } | null | undefined) {
    if (!pos) return null;
    return { left: `${pos.x * 100}px`, top: `${pos.y * 100}px` };
  }

  it('renders only objects and players on current map', async () => {
    const gameState = useGameStateStore();
    const mapStore = useMapStore();

    gameState.applySnapshot({
      currentMap: 'Map001',
      players: {
        p1: { playerId: 'p1', name: 'Player 1', mapName: 'Map001', position: { x: 0.1, y: 0.2 } },
        p2: { playerId: 'p2', name: 'Player 2', mapName: 'Map002', position: { x: 0.3, y: 0.4 } },
      },
      objects: {
        o1: { objectId: 'o1', name: 'Obj 1', mapName: 'Map001', position: { x: 0.5, y: 0.6 } },
        o2: { objectId: 'o2', name: 'Obj 2', mapName: 'Map002', position: { x: 0.7, y: 0.8 } },
      },
      spawnPoints: {},
    });

    const wrapper = mount(MapOverlay, {
      props: { positionToStyle },
    });
    await nextTick();

    const buttons = wrapper.findAll('button');
    expect(buttons.length).toBe(2);
    expect(wrapper.text()).toContain('Obj 1');
    expect(wrapper.text()).toContain('Player 1');
    expect(wrapper.text()).not.toContain('Obj 2');
    expect(wrapper.text()).not.toContain('Player 2');

    await buttons[0].trigger('click');
    expect(mapStore.selectedObjectId).toBe('o1');
  });

  it('does not render markers without position', async () => {
    const gameState = useGameStateStore();
    gameState.applySnapshot({
      currentMap: 'Map001',
      players: {
        p1: { playerId: 'p1', name: 'Player 1', mapName: 'Map001', position: null },
      },
      objects: {
        o1: { objectId: 'o1', name: 'Obj 1', mapName: 'Map001' },
      },
      spawnPoints: {},
    });

    const wrapper = mount(MapOverlay, {
      props: { positionToStyle },
    });
    await nextTick();
    expect(wrapper.findAll('button').length).toBe(0);
  });

  it('uses snapshot keys when objectId/playerId properties are absent', async () => {
    const gameState = useGameStateStore();
    const mapStore = useMapStore();

    gameState.applySnapshot({
      currentMap: 'Map001',
      players: {
        p1: { name: 'Player 1', mapName: 'Map001', position: { x: 0.1, y: 0.2 } },
      },
      objects: {
        o1: { name: 'Obj 1', mapName: 'Map001', position: { x: 0.5, y: 0.6 } },
      },
      spawnPoints: {},
    });

    const wrapper = mount(MapOverlay, {
      props: { positionToStyle },
    });
    await nextTick();

    const buttons = wrapper.findAll('button');
    expect(buttons.length).toBe(2);
    await buttons[0].trigger('click');
    expect(mapStore.selectedObjectId).toBe('o1');
  });
});
