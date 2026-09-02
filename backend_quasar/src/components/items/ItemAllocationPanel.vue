<template>
  <div>
    <div v-if="!objectId" class="text-grey text-caption">请在地图页选择对象</div>
    <div v-else>
      <div class="row items-center justify-between q-mb-sm">
        <div>
          <div class="text-subtitle1">{{ objectName }}</div>
          <div class="text-caption text-grey">{{ objectId }}</div>
        </div>
        <q-btn icon="add" color="primary" size="sm" label="添加道具" data-testid="open-picker" @click="openPicker" />
      </div>

      <q-list v-if="grouped.length > 0" bordered separator>
        <q-item v-for="[name, count] in grouped" :key="name">
          <q-item-section>
            <q-item-label>{{ name }}</q-item-label>
            <q-item-label caption>持有 {{ count }}</q-item-label>
          </q-item-section>
          <q-item-section side>
            <div class="row items-center q-gutter-xs">
              <q-btn
                icon="remove"
                size="xs"
                flat
                dense
                data-testid="remove-item"
                @click="removeOne(name)"
              />
              <span class="text-caption">{{ count }}</span>
              <q-btn
                icon="add"
                size="xs"
                flat
                dense
                data-testid="add-item"
                :disable="!canAdd(name)"
                @click="addOne(name)"
              />
            </div>
          </q-item-section>
        </q-item>
      </q-list>
      <div v-else class="text-grey text-caption">背包为空</div>
    </div>

    <item-picker-dialog v-model="pickerOpen" :object-id="objectId || ''" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useMapStore } from 'src/stores/mapStore';
import { useGameStateStore } from 'src/stores/gameStateStore';
import { useWsStore } from 'src/stores/wsStore';
import { parseComponentData } from 'src/services/gameState';
import {
  computeItemStock,
  computeHeldCount,
  canAddItem,
} from 'src/services/inventory';
import { setObjectItems } from 'src/services/protocol/commands';
import ItemPickerDialog from './ItemPickerDialog.vue';

const mapStore = useMapStore();
const gameState = useGameStateStore();
const ws = useWsStore();

const objectId = computed(() => mapStore.selectedObjectId);
const objectName = computed(() => {
  const obj = objectId.value ? gameState.getObject(objectId.value) : undefined;
  return obj?.name || objectId.value || '';
});

const pickerOpen = ref(false);

const grouped = computed(() => {
  const items = liveItems();
  const counts = new Map<string, number>();
  for (const name of items) {
    counts.set(name, (counts.get(name) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
});

function liveItems(): string[] {
  if (!objectId.value) return [];
  const obj = gameState.getObject(objectId.value);
  if (!obj?.componentData) return [];
  const blocks = parseComponentData(obj.componentData);
  const backpack = blocks?.find((b) => b.component === 'Backpack');
  return Array.isArray(backpack?.data.items) ? (backpack.data.items as string[]) : [];
}

function canAdd(name: string): boolean {
  const objects = gameState.snapshot.objects;
  const stock = computeItemStock(objects, name);
  const held = computeHeldCount(objects, name);
  return canAddItem(stock, held, 1);
}

function openPicker(): void {
  pickerOpen.value = true;
}

function removeOne(name: string): void {
  if (!objectId.value) return;
  const next = liveItems().slice();
  const idx = next.indexOf(name);
  if (idx < 0) return;
  next.splice(idx, 1);
  ws.send(setObjectItems(objectId.value, next));
}

function addOne(name: string): void {
  if (!objectId.value || !canAdd(name)) return;
  ws.send(setObjectItems(objectId.value, liveItems().concat([name])));
}
</script>
