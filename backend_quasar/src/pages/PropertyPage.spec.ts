import { describe, it, expect, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import { nextTick } from 'vue';
import PropertyPage from './PropertyPage.vue';
import { useGameStateStore } from 'src/stores/gameStateStore';
import { useMapStore } from 'src/stores/mapStore';
import type { ComponentBlock } from 'src/services/protocol/types';

describe('PropertyPage', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('shows placeholder when no object is selected', () => {
    const wrapper = mount(PropertyPage, {
      global: {
        stubs: {
          'q-page': { template: '<div><slot /></div>' },
          'property-field': { template: '<div />' },
          'item-picker-dialog': { template: '<div />' },
        },
      },
    });
    expect(wrapper.text()).toContain('在地图上选择一个对象');
  });

  it('renders property fields for selected object', async () => {
    const gameState = useGameStateStore();
    const mapStore = useMapStore();

    const blocks: ComponentBlock[] = [
      { component: 'IntValue', displayName: '生命值', data: { value: 10 } },
      { component: 'BoolValue', displayName: '激活', data: { value: true } },
    ];

    gameState.applySnapshot({
      currentMap: 'Map001',
      players: {},
      objects: {
        o1: {
          objectId: 'o1',
          name: 'Hero',
          mapName: 'Map001',
          componentData: JSON.stringify(blocks),
        },
      },
      spawnPoints: {},
    });

    mapStore.selectObject('o1');

    const wrapper = mount(PropertyPage, {
      global: {
        stubs: {
          'q-page': { template: '<div><slot /></div>' },
          'property-field': {
            props: ['objectId', 'block'],
            template: '<div class="field">{{ block.displayName }}</div>',
          },
          'item-picker-dialog': { template: '<div />' },
        },
      },
    });

    await nextTick();
    expect(wrapper.text()).toContain('Hero');
    const fields = wrapper.findAll('.field');
    expect(fields.length).toBe(2);
    expect(fields[0].text()).toBe('生命值');
    expect(fields[1].text()).toBe('激活');
  });
});
