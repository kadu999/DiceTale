import { describe, it, expect, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import { Quasar } from 'quasar';
import ItemsPage from './ItemsPage.vue';

describe('ItemsPage', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('renders category list, catalog, property panel and allocation panel', () => {
    const wrapper = mount(ItemsPage, {
      global: {
        plugins: [Quasar],
        stubs: {
          'q-page': { template: '<div><slot /></div>' },
          'item-category-list': { template: '<div class="categories" />' },
          'item-catalog': {
            props: ['selectedItem'],
            template: '<div class="catalog" />',
          },
          'item-property-panel': {
            props: ['itemName'],
            template: '<div class="property" />',
          },
          'item-allocation-panel': { template: '<div class="allocation" />' },
        },
      },
    });
    expect(wrapper.find('.categories').exists()).toBe(true);
    expect(wrapper.find('.catalog').exists()).toBe(true);
    expect(wrapper.find('.property').exists()).toBe(true);
    expect(wrapper.find('.allocation').exists()).toBe(true);
  });

  it('passes selected item from catalog to property panel', async () => {
    const wrapper = mount(ItemsPage, {
      global: {
        plugins: [Quasar],
        stubs: {
          'q-page': { template: '<div><slot /></div>' },
          'item-category-list': { template: '<div />' },
          'item-catalog': {
            props: ['selectedItem'],
            emits: ['select'],
            template: '<button class="catalog" @click="$emit(\'select\', \'Potion\')" />',
          },
          'item-property-panel': {
            props: ['itemName'],
            template: '<div class="property">{{ itemName }}</div>',
          },
          'item-allocation-panel': { template: '<div />' },
        },
      },
    });

    await wrapper.find('.catalog').trigger('click');
    expect(wrapper.find('.property').text()).toBe('Potion');
  });
});
