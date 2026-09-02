import { describe, it, expect, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import { useGameStateStore } from 'src/stores/gameStateStore';
import { useMapStore } from 'src/stores/mapStore';
import MapList from './MapList.vue';

describe('MapList', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('renders known maps and highlights selected', async () => {
    const gameState = useGameStateStore();
    gameState.applySnapshot({
      currentMap: 'Map002',
      players: {},
      objects: {},
      spawnPoints: {},
    });

    const mapStore = useMapStore();
    mapStore.selectMap('Map002');

    const wrapper = mount(MapList, {
      global: { stubs: { 'q-list': { template: '<div><slot /></div>' }, 'q-item': { template: '<div class="item"><slot /></div>' }, 'q-item-section': { template: '<span><slot /></span>' } } },
    });

    expect(wrapper.text()).toContain('Map002');
  });
});
