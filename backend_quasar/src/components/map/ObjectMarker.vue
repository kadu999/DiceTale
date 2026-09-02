<template>
  <button
    type="button"
    class="object-marker"
    :class="{ 'object-marker--selected': selected }"
    :style="markerStyle ?? {}"
    :data-object-id="objectId"
    @click="handleClick"
  >
    {{ label }}
  </button>
</template>

<script setup lang="ts">
import type { Position } from 'src/services/protocol/types';

const props = defineProps<{
  objectId: string;
  label: string;
  position: Position | null | undefined;
  selected: boolean;
  markerStyle: Record<string, string> | null;
}>();

const emit = defineEmits<{
  select: [id: string];
}>();

function handleClick(): void {
  emit('select', props.objectId);
}
</script>
