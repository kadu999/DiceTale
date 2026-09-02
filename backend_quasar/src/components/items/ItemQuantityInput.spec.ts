import { describe, it, expect, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { Quasar } from 'quasar';
import ItemQuantityInput from './ItemQuantityInput.vue';

describe('ItemQuantityInput', () => {
  beforeEach(() => {
    // Quasar plugin provides q-input registration.
  });

  it('renders initial value', () => {
    const wrapper = mount(ItemQuantityInput, {
      props: { modelValue: 3 },
      global: { plugins: [Quasar] },
    });
    expect((wrapper.find('input').element as HTMLInputElement).value).toBe('3');
  });

  it('emits clamped value on blur', async () => {
    const wrapper = mount(ItemQuantityInput, {
      props: { modelValue: 1 },
      global: { plugins: [Quasar] },
    });
    const input = wrapper.find('input');
    await input.setValue('0');
    await input.trigger('blur');
    expect(wrapper.emitted('update:modelValue')).toEqual([[1]]);
  });

  it('emits changed value when valid', async () => {
    const wrapper = mount(ItemQuantityInput, {
      props: { modelValue: 1 },
      global: { plugins: [Quasar] },
    });
    const input = wrapper.find('input');
    await input.setValue('5');
    await input.trigger('blur');
    expect(wrapper.emitted('update:modelValue')).toEqual([[5]]);
  });

  it('clamps to max when provided', async () => {
    const wrapper = mount(ItemQuantityInput, {
      props: { modelValue: 1, max: 3 },
      global: { plugins: [Quasar] },
    });
    const input = wrapper.find('input');
    await input.setValue('10');
    await input.trigger('blur');
    expect(wrapper.emitted('update:modelValue')).toEqual([[3]]);
  });
});
