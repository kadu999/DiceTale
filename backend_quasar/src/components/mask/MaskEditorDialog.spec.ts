import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import { Quasar, Notify } from 'quasar';
import MaskEditorDialog from './MaskEditorDialog.vue';
import { useGameStateStore } from 'src/stores/gameStateStore';

describe('MaskEditorDialog', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (this: HTMLCanvasElement, contextId: string) {
      if (contextId === '2d') {
        const data = new Uint8ClampedArray(this.width * this.height * 4);
        const imageData =
          typeof ImageData !== 'undefined'
            ? new ImageData(data, this.width, this.height)
            : ({ data, width: this.width, height: this.height } as unknown as ImageData);
        return {
          createImageData: () => imageData,
          putImageData: () => undefined,
        } as unknown as CanvasRenderingContext2D;
      }
      return originalGetContext.call(this, contextId);
    });
  });

  function mountDialog(props: { modelValue: boolean; objectId: string }) {
    return mount(MaskEditorDialog, {
      props,
      global: {
        plugins: [[Quasar, { plugins: { Notify } }]],
        stubs: {
          'q-dialog': {
            props: ['modelValue'],
            template: '<div class="q-dialog"><slot /></div>',
          },
          'q-card': { template: '<div class="q-card"><slot /></div>' },
          'q-card-section': { template: '<div class="q-card-section"><slot /></div>' },
          'q-card-actions': { template: '<div class="q-card-actions"><slot /></div>' },
          'q-btn': { template: '<button type="button"><slot /></button>' },
          'q-space': { template: '<span />' },
          'q-slider': { template: '<div class="q-slider" />' },
        },
      },
    });
  }

  it('closes and notifies when object does not exist', async () => {
    const wrapper = mountDialog({ modelValue: true, objectId: 'missing' });
    await flushPromises();
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([false]);
  });

  it('closes and notifies when mask dimensions are invalid', async () => {
    const gameState = useGameStateStore();
    gameState.applySnapshot({
      currentMap: 'Map001',
      players: {},
      objects: {
        o1: {
          objectId: 'o1',
          componentData: JSON.stringify([
            { component: 'MaskImage', data: { maskWidth: 8192, maskHeight: 100 } },
          ]),
        },
      },
      spawnPoints: {},
    });

    const wrapper = mountDialog({ modelValue: true, objectId: 'o1' });
    await flushPromises();
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([false]);
  });

  it('renders canvas when dimensions are valid', async () => {
    const gameState = useGameStateStore();
    gameState.applySnapshot({
      currentMap: 'Map001',
      players: {},
      objects: {
        o1: {
          objectId: 'o1',
          componentData: JSON.stringify([
            { component: 'MaskImage', data: { maskWidth: 200, maskHeight: 100 } },
          ]),
        },
      },
      spawnPoints: {},
    });

    const wrapper = mountDialog({ modelValue: true, objectId: 'o1' });
    await flushPromises();
    await flushPromises();
    expect(wrapper.find('canvas').exists()).toBe(true);
    expect(wrapper.emitted('update:modelValue')).toBeUndefined();
  });
});
