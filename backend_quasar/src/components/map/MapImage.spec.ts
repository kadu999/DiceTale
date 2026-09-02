import { describe, it, expect, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import { nextTick } from 'vue';
import MapImage from './MapImage.vue';
import { useGameStateStore } from 'src/stores/gameStateStore';

describe('MapImage', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('renders nothing when no effective map', async () => {
    const wrapper = mount(MapImage);
    await nextTick();
    expect(wrapper.find('img').exists()).toBe(false);
  });

  it('renders encoded map image src', async () => {
    const gameState = useGameStateStore();
    gameState.applySnapshot({
      currentMap: 'Map 001',
      players: {},
      objects: {},
      spawnPoints: {},
    });
    const wrapper = mount(MapImage);
    await nextTick();
    const img = wrapper.find('img');
    expect(img.exists()).toBe(true);
    expect(img.attributes('src')).toBe('/maps/Map%20001.png');
  });

  it('emits load and error events', async () => {
    const gameState = useGameStateStore();
    gameState.applySnapshot({ currentMap: 'Map001', players: {}, objects: {}, spawnPoints: {} });
    const wrapper = mount(MapImage);
    await nextTick();
    const img = wrapper.find('img');
    await img.trigger('load');
    expect(wrapper.emitted('load')).toHaveLength(1);
    await img.trigger('error');
    expect(wrapper.emitted('error')).toHaveLength(1);
  });
});
