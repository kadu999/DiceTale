<template>
  <img
    v-if="src"
    ref="img"
    :src="src"
    class="map-image"
    alt="地图"
    @load="onLoad"
    @error="onError"
  />
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useMapStore } from 'src/stores/mapStore';

const emit = defineEmits<{
  load: [];
  error: [];
}>();

const mapStore = useMapStore();
const img = ref<HTMLImageElement | null>(null);

const src = computed(() => {
  const map = mapStore.effectiveMap;
  return map ? `/maps/${encodeURIComponent(map)}.png` : '';
});

function onLoad(): void {
  emit('load');
}

function onError(): void {
  emit('error');
}

defineExpose({ img });
</script>
