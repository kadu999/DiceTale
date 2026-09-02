<template>
  <div class="map-property-panel">
    <div v-if="!objectId" class="text-grey text-caption q-pa-md text-center">
      请在地图上点击目标，查看并修改其属性
    </div>
    <div v-else-if="!object" class="text-negative text-caption q-pa-md text-center">
      未找到该目标（可能已移除）
    </div>
    <template v-else>
      <div class="text-subtitle2 q-px-md q-pt-sm">{{ object.name || object.objectId }}</div>
      <property-field
        v-for="block in blocks"
        :key="block.component"
        :object-id="objectId"
        :block="block"
        @open-picker="pickerOpen = true"
      />
      <item-picker-dialog v-model="pickerOpen" :object-id="objectId" />
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useMapStore } from 'src/stores/mapStore';
import { useGameStateStore } from 'src/stores/gameStateStore';
import { parseComponentData } from 'src/services/gameState';
import PropertyField from 'src/components/property/PropertyField.vue';
import ItemPickerDialog from 'src/components/items/ItemPickerDialog.vue';

const mapStore = useMapStore();
const gameState = useGameStateStore();

const objectId = computed(() => mapStore.selectedObjectId);
const object = computed(() => {
  if (!objectId.value) return undefined;
  return gameState.getObject(objectId.value) ?? gameState.getPlayer(objectId.value);
});
const blocks = computed(() => parseComponentData(object.value?.componentData ?? '') ?? []);
const pickerOpen = ref(false);
</script>
