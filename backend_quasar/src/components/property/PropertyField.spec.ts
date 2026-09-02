import { describe, it, expect, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import PropertyField from './PropertyField.vue';
import type { ComponentBlock } from 'src/services/protocol/types';

describe('PropertyField', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  function mountField(component: string, data: Record<string, unknown> = {}) {
    const block: ComponentBlock = { component, displayName: 'Test', data };
    return mount(PropertyField, {
      props: { objectId: 'o1', block },
      global: {
        stubs: {
          'q-btn': {
            props: ['label'],
            template: '<button type="button">{{ label }}<slot /></button>',
          },
          'q-input': { template: '<input />' },
          'q-slider': { template: '<div />' },
          'q-toggle': { template: '<input type="checkbox" />' },
          'mask-editor-dialog': { template: '<div />' },
        },
      },
    });
  }

  it('renders OptionValue for OptionValue component', () => {
    const wrapper = mountField('OptionValue', { options: ['A'], currentOption: 'A' });
    expect(wrapper.text()).toContain('A');
  });

  it('renders IntValue for IntValue component', () => {
    const wrapper = mountField('IntValue', { value: 10 });
    expect(wrapper.find('input').exists()).toBe(true);
  });

  it('renders FloatValue for FloatValue component', () => {
    const wrapper = mountField('FloatValue', { value: 1.5 });
    expect(wrapper.find('input').exists()).toBe(true);
  });

  it('renders BoolValue for BoolValue component', () => {
    const wrapper = mountField('BoolValue', { value: true });
    expect(wrapper.find('input[type="checkbox"]').exists()).toBe(true);
  });

  it('renders Backpack for Backpack component', () => {
    const wrapper = mountField('Backpack', { items: ['sword'] });
    expect(wrapper.text()).toContain('sword');
  });

  it('renders ItemExchange for ItemExchange component', () => {
    const wrapper = mountField('ItemExchange', { itemName: 'Potion', quantity: 3 });
    expect(wrapper.text()).toContain('Potion');
  });

  it('renders MaskImage for MaskImage component', () => {
    const wrapper = mountField('MaskImage', {});
    expect(wrapper.find('button').exists()).toBe(true);
  });

  it('renders nothing for unknown component', () => {
    const wrapper = mountField('Unknown', {});
    expect(wrapper.find('*').exists()).toBe(false);
  });
});
