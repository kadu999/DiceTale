import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { useWsStore } from './stores/wsStore';
import { useItemsStore } from './stores/itemsStore';
import { useGameStateStore } from './stores/gameStateStore';
import App from './App.vue';

const commonStubs = {
  'q-layout': { template: '<div><slot /></div>' },
  'q-header': { template: '<div><slot /></div>' },
  'q-toolbar': { template: '<div><slot /></div>' },
  'q-toolbar-title': { template: '<div><slot /></div>' },
  'q-page-container': { template: '<div><slot /></div>' },
  'q-footer': { template: '<div><slot /></div>' },
  'q-tabs': { template: '<div><slot /></div>' },
  'q-tab': { template: '<button>{{ label }}</button>' },
  'q-drawer': { template: '<div><slot /></div>' },
  'q-list': { template: '<div><slot /></div>' },
  'q-item': { template: '<div><slot /></div>' },
  'q-item-section': { template: '<div><slot /></div>' },
  'q-icon': { template: '<span />' },
  'q-btn': { template: '<button />' },
  'router-view': { template: '<div />' },
  'connection-status': { template: '<span />' },
};

const commonMocks = {
  $q: {
    screen: { lt: { md: false } },
    dark: { isActive: false, toggle: vi.fn(), set: vi.fn() },
  },
};

describe('App', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('connects websocket and loads item catalog and map list on mount', async () => {
    const ws = useWsStore();
    const connectSpy = vi.spyOn(ws, 'connect').mockImplementation(() => {});

    const items = useItemsStore();
    const setCatalogSpy = vi.spyOn(items, 'setCatalog').mockImplementation(() => {});

    const gameState = useGameStateStore();
    const setApiMapsSpy = vi.spyOn(gameState, 'setApiMaps').mockImplementation(() => {});

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url === '/api/maps') {
        return {
          ok: true,
          json: async () => ({ maps: [{ name: 'Map001', image: '/maps/Map001.png' }] }),
        } as Response;
      }
      return {
        ok: true,
        json: async () => ({ items: [{ name: 'Potion' }] }),
      } as Response;
    });

    mount(App, {
      global: {
        mocks: commonMocks,
        stubs: commonStubs,
      },
    });

    await flushPromises();

    expect(connectSpy).toHaveBeenCalledTimes(1);
    expect(setCatalogSpy).toHaveBeenCalledWith([{ name: 'Potion' }]);
    expect(setApiMapsSpy).toHaveBeenCalledWith([{ name: 'Map001', image: '/maps/Map001.png' }]);
  });

  it('logs errors when item catalog or map list fails to load', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    vi.spyOn(useWsStore(), 'connect').mockImplementation(() => {});
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network failure'));

    mount(App, {
      global: {
        mocks: commonMocks,
        stubs: commonStubs,
      },
    });

    await flushPromises();

    expect(consoleSpy).toHaveBeenCalledWith('加载道具目录失败', expect.any(Error));
    expect(consoleSpy).toHaveBeenCalledWith('加载地图列表失败', expect.any(Error));
  });
});
