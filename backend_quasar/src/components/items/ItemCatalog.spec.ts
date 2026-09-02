import { describe, it, expect, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import { Quasar } from 'quasar';
import ItemCatalog from './ItemCatalog.vue';
import { useItemsStore } from 'src/stores/itemsStore';

describe('ItemCatalog', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  function mountCatalog(props: { selectedItem?: string } = {}) {
    return mount(ItemCatalog, {
      props,
      global: { plugins: [Quasar] },
    });
  }

  it('renders catalog items as grid cells', () => {
    const items = useItemsStore();
    items.setCatalog([
      { name: 'Potion', category: 'Consumable', price: 10 },
      { name: 'Sword', category: 'Weapon' },
    ]);

    const wrapper = mountCatalog();
    const cells = wrapper.findAll('.item-cell');
    expect(cells).toHaveLength(2);
    expect(cells[0].text()).toContain('Potion');
    expect(cells[0].text()).toContain('$10');
    expect(cells[1].text()).toContain('Sword');
    expect(cells[1].text()).toContain('价格自定');
  });

  it('filters by search', async () => {
    const items = useItemsStore();
    items.setCatalog([
      { name: 'Potion', category: 'Consumable' },
      { name: 'Sword', category: 'Weapon' },
    ]);

    const wrapper = mountCatalog();
    const input = wrapper.find('input');
    await input.setValue('sword');
    await input.trigger('input');

    expect(wrapper.text()).not.toContain('Potion');
    expect(wrapper.text()).toContain('Sword');
  });

  it('emits select when item clicked', async () => {
    const items = useItemsStore();
    items.setCatalog([{ name: 'Potion', category: 'Consumable' }]);

    const wrapper = mountCatalog();
    await wrapper.find('.item-cell').trigger('click');
    expect(wrapper.emitted('select')).toEqual([['Potion']]);
  });

  it('marks the selected item cell', () => {
    const items = useItemsStore();
    items.setCatalog([{ name: 'Potion', category: 'Consumable' }]);

    const wrapper = mountCatalog({ selectedItem: 'Potion' });
    expect(wrapper.find('.item-cell.selected').exists()).toBe(true);
  });
});
