import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { GameStateSnapshot, ObjectInfo, PlayerInfo } from 'src/services/protocol/types';
import type { MapInfo } from 'src/services/mapsApi';

export const useGameStateStore = defineStore('gameState', () => {
  const snapshot = ref<GameStateSnapshot>({
    currentMap: '',
    players: Object.create(null),
    objects: Object.create(null),
    spawnPoints: Object.create(null),
  });
  const clientConnected = ref(false);
  const apiMaps = ref<MapInfo[]>([]);

  const knownMaps = computed(() => {
    const maps = new Set<string>();
    for (const map of apiMaps.value) {
      maps.add(map.name);
    }
    for (const obj of Object.values(snapshot.value.objects)) {
      if (obj.mapName) maps.add(obj.mapName);
    }
    for (const player of Object.values(snapshot.value.players)) {
      if (player.mapName) maps.add(player.mapName);
    }
    if (snapshot.value.currentMap) maps.add(snapshot.value.currentMap);
    return maps;
  });

  function setApiMaps(maps: MapInfo[]): void {
    apiMaps.value = maps;
  }

  function applySnapshot(next: GameStateSnapshot): void {
    snapshot.value = {
      currentMap: next.currentMap,
      players: next.players
        ? Object.assign(Object.create(null), next.players)
        : Object.create(null),
      objects: next.objects
        ? Object.assign(Object.create(null), next.objects)
        : Object.create(null),
      spawnPoints: next.spawnPoints
        ? Object.assign(Object.create(null), next.spawnPoints)
        : Object.create(null),
    };
  }

  function setClientConnected(value: boolean): void {
    clientConnected.value = value;
  }

  function getObject(objectId: string): ObjectInfo | undefined {
    return snapshot.value.objects[objectId];
  }

  function getPlayer(playerId: string): PlayerInfo | undefined {
    return snapshot.value.players[playerId];
  }

  return {
    snapshot: computed(() => snapshot.value),
    clientConnected: computed(() => clientConnected.value),
    apiMaps: computed(() => apiMaps.value),
    knownMaps,
    applySnapshot,
    setClientConnected,
    setApiMaps,
    getObject,
    getPlayer,
  };
});
