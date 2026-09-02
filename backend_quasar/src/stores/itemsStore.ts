import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { useGameStateStore } from './gameStateStore';
import { computeItemStock, computeHeldCount } from 'src/services/inventory';

export interface ItemCatalogEntry {
  name: string;
  price?: number | null;
  category?: string;
  identify?: boolean;
  usage?: string;
}

export const useItemsStore = defineStore('items', () => {
  const catalog = ref<ItemCatalogEntry[]>([]);
  const search = ref('');
  const category = ref('');
  const gameState = useGameStateStore();

  const filteredItems = computed(() => {
    const term = search.value.toLowerCase();
    return catalog.value.filter((item) => {
      const matchesSearch = !term || item.name.toLowerCase().includes(term);
      const matchesCategory = !category.value || item.category === category.value;
      return matchesSearch && matchesCategory;
    });
  });

  const categories = computed(() =>
    [...new Set(catalog.value.map((item) => item.category).filter((c): c is string => Boolean(c)))],
  );

  function setCatalog(items: ItemCatalogEntry[]): void {
    catalog.value = items;
  }

  function stockOf(itemName: string): number {
    return computeItemStock(gameState.snapshot.objects, itemName);
  }

  function heldOf(itemName: string): number {
    return computeHeldCount(gameState.snapshot.objects, itemName);
  }

  return {
    catalog: computed(() => catalog.value),
    search,
    category,
    filteredItems,
    categories,
    setCatalog,
    stockOf,
    heldOf,
  };
});
