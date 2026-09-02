<template>
  <button
    type="button"
    class="player-marker"
    :class="{ 'player-marker--selected': selected }"
    :style="markerStyle ?? {}"
    :data-player-id="playerId"
    @click="handleClick"
  >
    {{ label }}
  </button>
</template>

<script setup lang="ts">
import type { Position } from 'src/services/protocol/types';

const props = defineProps<{
  playerId: string;
  label: string;
  position: Position | null | undefined;
  selected: boolean;
  markerStyle: Record<string, string> | null;
}>();

const emit = defineEmits<{
  select: [id: string];
}>();

function handleClick(): void {
  emit('select', props.playerId);
}
</script>
