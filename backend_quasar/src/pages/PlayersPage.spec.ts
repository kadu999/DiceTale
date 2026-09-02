import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import { nextTick } from 'vue';
import PlayersPage from './PlayersPage.vue';
import { useGameStateStore } from 'src/stores/gameStateStore';
import { useMapStore } from 'src/stores/mapStore';

const pushMock = vi.fn();
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: pushMock }),
}));

describe('PlayersPage', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    pushMock.mockReset();
  });

  function mountPage() {
    return mount(PlayersPage, {
      global: {
        stubs: {
          'q-page': { template: '<div><slot /></div>' },
          'q-card': { template: '<div class="q-card"><slot /></div>' },
          'q-card-section': { template: '<div class="q-card-section"><slot /></div>' },
          'q-badge': {
            props: ['color'],
            template: '<span class="q-badge" :class="color"><slot /></span>',
          },
        },
      },
    });
  }

  it('shows placeholder when no players exist', () => {
    const wrapper = mountPage();
    expect(wrapper.text()).toContain('暂无玩家');
  });

  it('renders players sorted by name or playerId', async () => {
    const gameState = useGameStateStore();
    gameState.applySnapshot({
      currentMap: 'Map001',
      players: {
        p2: { playerId: 'p2', name: 'Bob', mapName: 'Map001' },
        p1: { playerId: 'p1', name: 'Alice', mapName: 'Map002' },
        p3: { playerId: 'p3', mapName: null },
      },
      objects: {},
      spawnPoints: {},
    });

    const wrapper = mountPage();
    await nextTick();

    const cards = wrapper.findAll('.q-card');
    expect(cards.length).toBe(3);
    expect(cards[0].text()).toContain('Alice');
    expect(cards[1].text()).toContain('Bob');
    expect(cards[2].text()).toContain('p3');
  });

  it('selects player and navigates to property page on card click', async () => {
    const gameState = useGameStateStore();
    const mapStore = useMapStore();
    gameState.applySnapshot({
      currentMap: 'Map001',
      players: {
        p1: { playerId: 'p1', name: 'Alice', mapName: 'Map001' },
      },
      objects: {},
      spawnPoints: {},
    });

    const wrapper = mountPage();
    await nextTick();

    await wrapper.find('.q-card').trigger('click');

    expect(mapStore.selectedObjectId).toBe('p1');
    expect(pushMock).toHaveBeenCalledWith('/property');
  });
});
