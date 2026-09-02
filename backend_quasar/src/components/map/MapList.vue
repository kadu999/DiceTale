<template>
  <div class="map-list">
    <q-list dense separator>
      <q-item
        v-for="map in sortedMaps"
        :key="map"
        clickable
        :active="mapStore.selectedMap === map"
        active-class="bg-primary text-white"
        @click="mapStore.selectMap(map)"
      >
        <q-item-section>{{ map }}</q-item-section>
      </q-item>
    </q-list>
    <div v-if="sortedMaps.length === 0" class="text-grey text-caption q-pa-sm text-center">
      暂无地图
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useMapStore } from 'src/stores/mapStore';

const mapStore = useMapStore();

const sortedMaps = computed(() => [...mapStore.knownMaps].sort());
</script>
