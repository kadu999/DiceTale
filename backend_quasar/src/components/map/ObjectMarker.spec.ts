import { describe, it, expect, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import ObjectMarker from './ObjectMarker.vue';
import { useMapStore } from 'src/stores/mapStore';

describe('ObjectMarker', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('renders label and emits select on click', async () => {
    const wrapper = mount(ObjectMarker, {
      props: {
        objectId: 'o1',
        label: 'Obj A',
        position: { x: 0.5, y: 0.5 },
        selected: false,
        markerStyle: { left: '10px', top: '20px' },
      },
    });
    expect(wrapper.text()).toContain('Obj A');
    await wrapper.find('button').trigger('click');
    expect(wrapper.emitted('select')).toEqual([['o1']]);
  });

  it('applies selected class', () => {
    const wrapper = mount(ObjectMarker, {
      props: {
        objectId: 'o1',
        label: 'Obj A',
        position: { x: 0.5, y: 0.5 },
        selected: true,
        markerStyle: { left: '10px', top: '20px' },
      },
    });
    expect(wrapper.find('button').classes()).toContain('object-marker--selected');
  });
});

describe('ObjectMarker integration with mapStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('clicking marker selects object in mapStore', async () => {
    const mapStore = useMapStore();
    const wrapper = mount(ObjectMarker, {
      props: {
        objectId: 'o1',
        label: 'Obj A',
        position: { x: 0.5, y: 0.5 },
        selected: false,
        markerStyle: { left: '10px', top: '20px' },
        'onSelect': (id: string) => mapStore.selectObject(id),
      },
    });
    await wrapper.find('button').trigger('click');
    expect(mapStore.selectedObjectId).toBe('o1');
  });
});
