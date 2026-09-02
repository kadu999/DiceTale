<template>
  <div class="map-overlay">
    <object-marker
      v-for="[id, object] in currentObjects"
      :key="id"
      :object-id="id"
      :label="object.name || id"
      :position="object.position"
      :selected="mapStore.selectedObjectId === id"
      :marker-style="positionToStyle(object.position)"
      @select="selectObject"
    />
    <player-marker
      v-for="[id, player] in currentPlayers"
      :key="id"
      :player-id="id"
      :label="player.name || id"
      :position="player.position"
      :selected="mapStore.selectedObjectId === id"
      :marker-style="positionToStyle(player.position)"
      @select="selectObject"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { ObjectInfo, PlayerInfo, Position } from 'src/services/protocol/types';
import { useMapStore } from 'src/stores/mapStore';
import { useGameStateStore } from 'src/stores/gameStateStore';
import ObjectMarker from './ObjectMarker.vue';
import PlayerMarker from './PlayerMarker.vue';

const props = defineProps<{
  positionToStyle: (pos: Position | null | undefined) => Record<string, string> | null;
}>();

const mapStore = useMapStore();
const gameState = useGameStateStore();

const currentMap = computed(() => mapStore.effectiveMap);

const currentObjects = computed(() =>
  Object.entries(gameState.snapshot.objects).filter(
    (entry): entry is [string, ObjectInfo & { position: Position }] => {
      const [, o] = entry;
      return o.mapName === currentMap.value && !!o.position;
    },
  ),
);

const currentPlayers = computed(() =>
  Object.entries(gameState.snapshot.players).filter(
    (entry): entry is [string, PlayerInfo & { position: Position }] => {
      const [, p] = entry;
      return p.mapName === currentMap.value && !!p.position;
    },
  ),
);

function selectObject(id: string): void {
  mapStore.selectObject(id);
}
</script>
