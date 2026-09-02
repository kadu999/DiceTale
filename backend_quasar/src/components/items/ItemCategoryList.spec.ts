import { describe, it, expect, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import { Quasar } from 'quasar';
import ItemCategoryList from './ItemCategoryList.vue';
import { useItemsStore } from 'src/stores/itemsStore';

describe('ItemCategoryList', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('renders 全部 plus distinct categories', () => {
    const items = useItemsStore();
    items.setCatalog([
      { name: 'Potion', category: 'Consumable' },
      { name: 'Sword', category: 'Weapon' },
      { name: 'Knife', category: 'Weapon' },
    ]);

    const wrapper = mount(ItemCategoryList, { global: { plugins: [Quasar] } });
    expect(wrapper.text()).toContain('全部');
    expect(wrapper.text()).toContain('Consumable');
    expect(wrapper.text()).toContain('Weapon');
  });

  it('sets store category when clicked', async () => {
    const items = useItemsStore();
    items.setCatalog([{ name: 'Potion', category: 'Consumable' }]);

    const wrapper = mount(ItemCategoryList, { global: { plugins: [Quasar] } });
    const entries = wrapper.findAll('.q-item');
    await entries[1].trigger('click');
    expect(items.category).toBe('Consumable');
  });
});
