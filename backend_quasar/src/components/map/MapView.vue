<template>
  <div ref="container" class="map-view">
    <map-image ref="mapImageRef" @load="onImageLoad" @error="onImageError" />
    <map-overlay :position-to-style="positionToStyle" />
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import { useQuasar } from 'quasar';
import { useMapCoordinates } from 'src/composables/useMapCoordinates';
import MapImage from './MapImage.vue';
import MapOverlay from './MapOverlay.vue';

const $q = useQuasar();
const container = ref<HTMLElement | null>(null);
const mapImageRef = ref<InstanceType<typeof MapImage> | null>(null);
const imageRef = ref<HTMLImageElement | null>(null);
const tick = ref(0);

const { positionToStyle } = useMapCoordinates(container, imageRef, tick);

function refresh(): void {
  tick.value += 1;
}

function onImageLoad(): void {
  refresh();
}

function onImageError(): void {
  $q.notify({
    type: 'negative',
    message: '地图图片加载失败',
    position: 'top',
    timeout: 3000,
  });
}

function onWindowResize(): void {
  refresh();
}

onMounted(() => {
  imageRef.value = mapImageRef.value?.img ?? null;
  window.addEventListener('resize', onWindowResize);
  refresh();
});

onUnmounted(() => {
  window.removeEventListener('resize', onWindowResize);
});
</script>
