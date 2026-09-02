<template>
  <q-page padding>
    <div class="text-h5 q-mb-md">玩家</div>
    <div v-if="players.length === 0" class="text-grey text-center q-mt-xl">
      暂无玩家
    </div>
    <div v-else class="row q-col-gutter-md">
      <div
        v-for="player in players"
        :key="player.playerId"
        class="col-6 col-sm-4 col-md-3"
      >
        <player-card :player="player" @select="selectPlayer" />
      </div>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useGameStateStore } from 'src/stores/gameStateStore';
import { useMapStore } from 'src/stores/mapStore';
import PlayerCard from 'src/components/players/PlayerCard.vue';
import type { PlayerInfo } from 'src/services/protocol/types';

const gameState = useGameStateStore();
const mapStore = useMapStore();
const router = useRouter();

const players = computed<PlayerInfo[]>(() => {
  const list = Object.values(gameState.snapshot.players);
  return list.sort((a, b) => {
    const nameA = a.name || a.playerId;
    const nameB = b.name || b.playerId;
    return nameA.localeCompare(nameB);
  });
});

function selectPlayer(playerId: string): void {
  mapStore.selectObject(playerId);
  void router.push('/property');
}
</script>
