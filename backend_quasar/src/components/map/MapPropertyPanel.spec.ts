import { describe, it, expect, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import { useGameStateStore } from 'src/stores/gameStateStore';
import { useMapStore } from 'src/stores/mapStore';
import MapPropertyPanel from './MapPropertyPanel.vue';

describe('MapPropertyPanel', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('shows placeholder when no object selected', () => {
    const wrapper = mount(MapPropertyPanel, {
      global: { stubs: { 'property-field': { template: '<div />' } } },
    });
    expect(wrapper.text()).toContain('请在地图上点击目标');
  });

  it('renders property fields for selected object', async () => {
    const gameState = useGameStateStore();
    const mapStore = useMapStore();

    gameState.applySnapshot({
      currentMap: 'Map001',
      players: {},
      objects: {
        o1: {
          objectId: 'o1',
          name: 'Hero',
          mapName: 'Map001',
          componentData: JSON.stringify([{ component: 'IntValue', displayName: '生命值', data: { value: 10 } }]),
        },
      },
      spawnPoints: {},
    });
    mapStore.selectObject('o1');

    const wrapper = mount(MapPropertyPanel, {
      global: {
        stubs: {
          'property-field': { template: '<div class="field" />' },
          'item-picker-dialog': { template: '<div />' },
        },
      },
    });

    await flushPromises();
    expect(wrapper.text()).toContain('Hero');
    expect(wrapper.findAll('.field')).toHaveLength(1);
  });

  it('opens item picker dialog when a property field requests it', async () => {
    const gameState = useGameStateStore();
    const mapStore = useMapStore();

    gameState.applySnapshot({
      currentMap: 'Map001',
      players: {},
      objects: {
        o1: {
          objectId: 'o1',
          name: 'Hero',
          mapName: 'Map001',
          componentData: JSON.stringify([{ component: 'Backpack', displayName: '背包', data: { items: [] } }]),
        },
      },
      spawnPoints: {},
    });
    mapStore.selectObject('o1');

    const wrapper = mount(MapPropertyPanel, {
      global: {
        stubs: {
          'property-field': {
            template: '<button class="field" @click="$emit(\'open-picker\')" />',
            emits: ['open-picker'],
          },
          'item-picker-dialog': {
            template: '<div class="picker-dialog" />',
            props: ['modelValue', 'objectId'],
          },
        },
      },
    });

    await flushPromises();
    await wrapper.find('.field').trigger('click');
    await flushPromises();

    const dialog = wrapper.findComponent('.picker-dialog');
    expect(dialog.props('modelValue')).toBe(true);
    expect(dialog.props('objectId')).toBe('o1');
  });
});
