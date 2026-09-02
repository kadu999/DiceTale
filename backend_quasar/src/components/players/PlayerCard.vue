<template>
  <q-card class="player-card cursor-pointer" @click="handleClick">
    <q-card-section>
      <div class="text-h6">{{ displayName }}</div>
      <div class="text-caption text-grey">地图：{{ player.mapName || '-' }}</div>
      <q-badge :color="onlineColor" class="q-mt-sm">{{ onlineLabel }}</q-badge>
    </q-card-section>
  </q-card>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useGameStateStore } from 'src/stores/gameStateStore';
import type { PlayerInfo } from 'src/services/protocol/types';

const props = defineProps<{ player: PlayerInfo }>();
const emit = defineEmits<{ select: [playerId: string] }>();

const gameState = useGameStateStore();

const displayName = computed(() => props.player.name || props.player.playerId);

// PlayerInfo 目前没有独立的在线字段，使用全局客户端连接状态作为在线指示
const onlineLabel = computed(() => (gameState.clientConnected ? '在线' : '离线'));
const onlineColor = computed(() => (gameState.clientConnected ? 'positive' : 'grey'));

function handleClick(): void {
  emit('select', props.player.playerId);
}
</script>

<style scoped>
.player-card {
  transition: box-shadow 0.2s;
}
.player-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}
</style>
