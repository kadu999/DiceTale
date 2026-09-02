import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import { Quasar } from 'quasar';
import { nextTick } from 'vue';
import ItemAllocationPanel from './ItemAllocationPanel.vue';
import { useGameStateStore } from 'src/stores/gameStateStore';
import { useMapStore } from 'src/stores/mapStore';
import { useWsStore } from 'src/stores/wsStore';

describe('ItemAllocationPanel', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  function mountPanel() {
    return mount(ItemAllocationPanel, {
      global: {
        plugins: [Quasar],
        stubs: { 'item-picker-dialog': { template: '<div class="picker" />' } },
      },
    });
  }

  it('shows placeholder when no object selected', () => {
    const wrapper = mountPanel();
    expect(wrapper.text()).toContain('请在地图页选择对象');
  });

  it('renders backpack items for selected object', async () => {
    const gameState = useGameStateStore();
    const mapStore = useMapStore();
    gameState.applySnapshot({
      currentMap: 'Map001',
      players: {},
      objects: {
        o1: {
          objectId: 'o1',
          name: 'Hero',
          componentData: JSON.stringify([
            { component: 'Backpack', data: { items: ['Potion', 'Potion', 'Sword'] } },
          ]),
        },
      },
      spawnPoints: {},
    });
    mapStore.selectObject('o1');

    const wrapper = mountPanel();
    await nextTick();
    expect(wrapper.text()).toContain('Hero');
    expect(wrapper.text()).toContain('Potion');
    expect(wrapper.text()).toContain('Sword');
  });

  it('sends set_object_items when removing one item', async () => {
    const gameState = useGameStateStore();
    const mapStore = useMapStore();
    const ws = useWsStore();
    const sendSpy = vi.spyOn(ws, 'send').mockReturnValue(true);

    gameState.applySnapshot({
      currentMap: 'Map001',
      players: {},
      objects: {
        o1: {
          objectId: 'o1',
          componentData: JSON.stringify([
            { component: 'Backpack', data: { items: ['Potion', 'Sword'] } },
          ]),
        },
      },
      spawnPoints: {},
    });
    mapStore.selectObject('o1');

    const wrapper = mountPanel();
    await nextTick();
    const removeButtons = wrapper.findAll('[data-testid="remove-item"]');
    expect(removeButtons.length).toBeGreaterThan(0);
    await removeButtons[0].trigger('click');

    expect(sendSpy).toHaveBeenCalledTimes(1);
    expect(sendSpy).toHaveBeenCalledWith({
      type: 'gm_set_object_items',
      objectId: 'o1',
      items: ['Sword'],
    });
  });

  it('sends set_object_items when adding one item', async () => {
    const gameState = useGameStateStore();
    const mapStore = useMapStore();
    const ws = useWsStore();
    const sendSpy = vi.spyOn(ws, 'send').mockReturnValue(true);

    gameState.applySnapshot({
      currentMap: 'Map001',
      players: {},
      objects: {
        shop: {
          objectId: 'shop',
          componentData: JSON.stringify([
            { component: 'ItemExchange', data: { itemName: 'Potion', quantity: 5 } },
          ]),
        },
        o1: {
          objectId: 'o1',
          componentData: JSON.stringify([
            { component: 'Backpack', data: { items: ['Potion', 'Sword'] } },
          ]),
        },
      },
      spawnPoints: {},
    });
    mapStore.selectObject('o1');

    const wrapper = mountPanel();
    await nextTick();
    const addButtons = wrapper.findAll('[data-testid="add-item"]');
    expect(addButtons.length).toBeGreaterThan(0);
    await addButtons[0].trigger('click');

    expect(sendSpy).toHaveBeenCalledTimes(1);
    expect(sendSpy).toHaveBeenCalledWith({
      type: 'gm_set_object_items',
      objectId: 'o1',
      items: ['Potion', 'Sword', 'Potion'],
    });
  });
});
