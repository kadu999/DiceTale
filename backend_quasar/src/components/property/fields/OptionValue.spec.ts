import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import { useWsStore } from 'src/stores/wsStore';
import OptionValue from './OptionValue.vue';

const QBtnStub = {
  props: ['label'],
  template: '<button type="button">{{ label }}</button>',
};

describe('OptionValue', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('renders options', () => {
    const wrapper = mount(OptionValue, {
      props: {
        objectId: 'o1',
        componentType: 'State',
        data: { options: ['A', 'B'], currentOption: 'A' },
        labelText: '状态',
      },
      global: { stubs: { 'q-btn': QBtnStub } },
    });
    expect(wrapper.text()).toContain('状态');
    expect(wrapper.text()).toContain('A');
    expect(wrapper.text()).toContain('B');
  });

  it('sends gm_set_option when selecting a different value', async () => {
    const ws = useWsStore();
    const sendSpy = vi.spyOn(ws, 'send').mockReturnValue(true);

    const wrapper = mount(OptionValue, {
      props: {
        objectId: 'o1',
        componentType: 'State',
        data: { options: ['A', 'B'], currentOption: 'A' },
        labelText: '状态',
      },
      global: { stubs: { 'q-btn': QBtnStub } },
    });

    await wrapper.findAll('button')[1].trigger('click');
    expect(sendSpy).toHaveBeenCalledTimes(1);
    expect(sendSpy).toHaveBeenCalledWith({ type: 'gm_set_option', objectId: 'o1', option: 'B' });
  });

  it('does not send when selecting the current value', async () => {
    const ws = useWsStore();
    const sendSpy = vi.spyOn(ws, 'send').mockReturnValue(true);

    const wrapper = mount(OptionValue, {
      props: {
        objectId: 'o1',
        componentType: 'State',
        data: { options: ['A', 'B'], currentOption: 'A' },
        labelText: '状态',
      },
      global: { stubs: { 'q-btn': QBtnStub } },
    });

    await wrapper.findAll('button')[0].trigger('click');
    expect(sendSpy).not.toHaveBeenCalled();
  });
});
