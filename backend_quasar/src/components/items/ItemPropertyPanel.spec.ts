import { describe, it, expect, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import { Quasar } from 'quasar';
import ItemPropertyPanel from './ItemPropertyPanel.vue';
import { useItemsStore } from 'src/stores/itemsStore';
import { useGameStateStore } from 'src/stores/gameStateStore';

describe('ItemPropertyPanel', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  function mountPanel(itemName?: string) {
    return mount(ItemPropertyPanel, {
      props: { itemName },
      global: { plugins: [Quasar] },
    });
  }

  it('shows hint when no item selected', () => {
    const wrapper = mountPanel();
    expect(wrapper.text()).toContain('点击中间道具查看属性');
  });

  it('shows item properties when selected', () => {
    const items = useItemsStore();
    items.setCatalog([
      { name: 'Potion', category: 'Consumable', price: 10, identify: true, usage: '回血' },
    ]);

    const wrapper = mountPanel('Potion');
    expect(wrapper.text()).toContain('Consumable');
    expect(wrapper.text()).toContain('$10');
    expect(wrapper.text()).toContain('回血');
  });

  it('shows stock and remaining count', () => {
    const gameState = useGameStateStore();
    gameState.applySnapshot({
      currentMap: 'Map001',
      players: {},
      objects: {
        shop: {
          objectId: 'shop',
          componentData: JSON.stringify([
            { component: 'ItemExchange', data: { itemName: 'Potion', quantity: 2 } },
          ]),
        },
      },
      spawnPoints: {},
    });

    const items = useItemsStore();
    items.setCatalog([{ name: 'Potion', category: 'Consumable' }]);

    const wrapper = mountPanel('Potion');
    expect(wrapper.text()).toContain('库存');
    expect(wrapper.text()).toContain('剩余可分配');
  });
});
