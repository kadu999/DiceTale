import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useItemsStore } from './itemsStore';
import { useGameStateStore } from './gameStateStore';

describe('itemsStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('filters catalog by search and category', () => {
    const store = useItemsStore();
    store.setCatalog([
      { name: 'Potion', category: 'Consumable' },
      { name: 'Sword', category: 'Weapon' },
      { name: 'Great Potion', category: 'Consumable' },
    ]);

    store.search = 'Potion';
    expect(store.filteredItems).toHaveLength(2);

    store.category = 'Weapon';
    expect(store.filteredItems).toHaveLength(0);

    store.search = '';
    expect(store.filteredItems).toHaveLength(1);
  });

  it('exposes unique categories', () => {
    const store = useItemsStore();
    store.setCatalog([
      { name: 'Potion', category: 'Consumable' },
      { name: 'Sword', category: 'Weapon' },
      { name: 'Ether', category: 'Consumable' },
    ]);
    expect(store.categories).toEqual(['Consumable', 'Weapon']);
  });

  it('computes stock and held counts from game state', () => {
    const gameState = useGameStateStore();
    gameState.applySnapshot({
      currentMap: 'Map001',
      players: {},
      objects: {
        shop: {
          objectId: 'shop',
          componentData: JSON.stringify([
            { component: 'ItemExchange', data: { itemName: 'Potion', quantity: 5 } },
          ]),
        },
        player: {
          objectId: 'player',
          componentData: JSON.stringify([
            { component: 'Backpack', data: { items: ['Potion', 'Potion'] } },
          ]),
        },
      },
      spawnPoints: {},
    });

    const items = useItemsStore();
    expect(items.stockOf('Potion')).toBe(5);
    expect(items.heldOf('Potion')).toBe(2);
  });

  it('returns all items when search is empty', () => {
    const store = useItemsStore();
    store.setCatalog([
      { name: 'Potion', category: 'Consumable' },
      { name: 'Sword', category: 'Weapon' },
    ]);
    store.search = '';
    expect(store.filteredItems).toHaveLength(2);
  });

  it('returns empty list when category does not exist', () => {
    const store = useItemsStore();
    store.setCatalog([
      { name: 'Potion', category: 'Consumable' },
    ]);
    store.category = 'NonExistent';
    expect(store.filteredItems).toHaveLength(0);
  });

  it('returns Infinity stock when no ItemExchange source exists', () => {
    const gameState = useGameStateStore();
    gameState.applySnapshot({
      currentMap: 'Map001',
      players: {},
      objects: {},
      spawnPoints: {},
    });

    const items = useItemsStore();
    expect(items.stockOf('Potion')).toBe(Infinity);
  });
});
