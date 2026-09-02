import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import { Quasar } from 'quasar';
import { nextTick } from 'vue';
import ItemPickerDialog from './ItemPickerDialog.vue';
import { useItemsStore } from 'src/stores/itemsStore';
import { useGameStateStore } from 'src/stores/gameStateStore';
import { useWsStore } from 'src/stores/wsStore';

describe('ItemPickerDialog', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  function mountDialog(props: { modelValue: boolean; objectId: string }) {
    return mount(ItemPickerDialog, {
      props,
      global: {
        plugins: [Quasar],
        stubs: { 'q-dialog': { template: '<div class="q-dialog"><slot /></div>' } },
      },
    });
  }

  it('sends set_object_items with selected item and quantity', async () => {
    const items = useItemsStore();
    items.setCatalog([{ name: 'Potion', category: 'Consumable', price: 10 }]);

    const gameState = useGameStateStore();
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
            { component: 'Backpack', data: { items: ['Sword'] } },
          ]),
        },
      },
      spawnPoints: {},
    });

    const wrapper = mountDialog({ modelValue: true, objectId: 'o1' });
    await nextTick();

    await wrapper.find('.item-cell').trigger('click');
    await wrapper.find('input[type="number"]').setValue('2');
    await wrapper.find('input[type="number"]').trigger('blur');
    await nextTick();

    const confirmButton = wrapper.find('[data-testid="confirm-add"]');
    expect(confirmButton.attributes('disabled')).toBeUndefined();
    await confirmButton.trigger('click');

    expect(sendSpy).toHaveBeenCalledTimes(1);
    expect(sendSpy).toHaveBeenCalledWith({
      type: 'gm_set_object_items',
      objectId: 'o1',
      items: ['Sword', 'Potion', 'Potion'],
    });
  });

  it('disables item cell and confirm when no stock remaining', async () => {
    const items = useItemsStore();
    items.setCatalog([{ name: 'Potion', category: 'Consumable' }]);

    const gameState = useGameStateStore();
    gameState.applySnapshot({
      currentMap: 'Map001',
      players: {},
      objects: {
        shop: {
          objectId: 'shop',
          componentData: JSON.stringify([
            { component: 'ItemExchange', data: { itemName: 'Potion', quantity: 1 } },
          ]),
        },
        o1: {
          objectId: 'o1',
          componentData: JSON.stringify([
            { component: 'Backpack', data: { items: ['Potion'] } },
          ]),
        },
      },
      spawnPoints: {},
    });

    const wrapper = mountDialog({ modelValue: true, objectId: 'o1' });
    await nextTick();

    const cell = wrapper.find('.item-cell');
    expect(cell.attributes('disabled')).toBeDefined();

    const confirmButton = wrapper.find('[data-testid="confirm-add"]');
    expect(confirmButton.attributes('disabled')).toBeDefined();
  });

  it('filters by category and search', async () => {
    const items = useItemsStore();
    items.setCatalog([
      { name: 'Potion', category: 'Consumable' },
      { name: 'Sword', category: 'Weapon' },
    ]);

    const wrapper = mountDialog({ modelValue: true, objectId: 'o1' });
    await nextTick();

    expect(wrapper.findAll('.item-cell').length).toBe(2);

    await wrapper.findAll('.picker-list .q-item').at(1)?.trigger('click');
    await nextTick();
    expect(wrapper.findAll('.item-cell').length).toBe(1);
    expect(wrapper.find('.item-cell').text()).toContain('Potion');

    // 切回「全部」后再用搜索
    await wrapper.findAll('.picker-list .q-item').at(0)?.trigger('click');
    await nextTick();
    await wrapper.find('input[placeholder="搜索道具名 / 类别"]').setValue('Sword');
    await nextTick();
    expect(wrapper.findAll('.item-cell').length).toBe(1);
    expect(wrapper.find('.item-cell').text()).toContain('Sword');
  });

  it('shows item details when selected', async () => {
    const items = useItemsStore();
    items.setCatalog([
      { name: 'Potion', category: 'Consumable', price: 12.5, identify: true, usage: '恢复 HP' },
    ]);

    const wrapper = mountDialog({ modelValue: true, objectId: 'o1' });
    await nextTick();

    await wrapper.find('.item-cell').trigger('click');
    await nextTick();

    expect(wrapper.text()).toContain('Consumable');
    expect(wrapper.text()).toContain('$12.5');
    expect(wrapper.text()).toContain('是');
    expect(wrapper.text()).toContain('恢复 HP');
  });
});
