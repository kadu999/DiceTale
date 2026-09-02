import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { useGameStateStore } from './gameStateStore';

export const useMapStore = defineStore('map', () => {
  const gameState = useGameStateStore();
  const selectedMap = ref<string | null>(null);
  const selectedObjectId = ref<string | null>(null);

  const effectiveMap = computed(() => {
    if (selectedMap.value && gameState.knownMaps.has(selectedMap.value)) return selectedMap.value;
    if (gameState.snapshot.currentMap) return gameState.snapshot.currentMap;
    const first = [...gameState.knownMaps][0];
    return first ?? null;
  });

  function selectMap(name: string | null): void {
    selectedMap.value = name;
  }

  function selectObject(id: string | null): void {
    selectedObjectId.value = id;
  }

  return {
    selectedMap: computed(() => selectedMap.value),
    selectedObjectId: computed(() => selectedObjectId.value),
    knownMaps: computed(() => gameState.knownMaps),
    effectiveMap,
    selectMap,
    selectObject,
  };
});
