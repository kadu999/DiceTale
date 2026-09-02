<template>
  <div class="q-my-sm">
    <div class="row items-center justify-between">
      <span class="text-caption">{{ labelText }}</span>
      <q-btn icon="add" size="sm" label="添加道具" @click="$emit('open-picker')" />
    </div>

    <div v-if="grouped.length === 0" class="text-grey text-caption">暂无物品</div>
    <div v-for="[name, count] in grouped" :key="name" class="property-distribute-line">
      <q-btn icon="remove" size="xs" flat dense @click="removeOne(name)" />
      <span class="property-distribute-name">{{ name }}</span>
      <span class="property-distribute-count">{{ count }}</span>
      <q-btn
        icon="add"
        size="xs"
        flat
        dense
        :disable="!canAdd(name)"
        @click="addOne(name)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useWsStore } from 'src/stores/wsStore';
import { useGameStateStore } from 'src/stores/gameStateStore';
import { parseComponentData } from 'src/services/gameState';
import {
  computeItemStock,
  computeHeldCount,
  canAddItem,
} from 'src/services/inventory';
import { setObjectItems } from 'src/services/protocol/commands';

const props = defineProps<{
  objectId: string;
  componentType: string;
  data: Record<string, unknown>;
  labelText: string;
}>();

defineEmits<{ 'open-picker': [] }>();

const ws = useWsStore();
const gameState = useGameStateStore();

const displayItems = computed(() =>
  Array.isArray(props.data.items) ? (props.data.items as string[]) : [],
);

const grouped = computed(() => {
  const counts = new Map<string, number>();
  for (const name of displayItems.value) {
    counts.set(name, (counts.get(name) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
});

function liveItems(): string[] {
  const obj = gameState.getObject(props.objectId);
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

function removeOne(name: string): void {
  const next = liveItems().slice();
  const idx = next.indexOf(name);
  if (idx < 0) return;
  next.splice(idx, 1);
  ws.send(setObjectItems(props.objectId, next));
}

function addOne(name: string): void {
  if (!canAdd(name)) return;
  ws.send(setObjectItems(props.objectId, liveItems().concat([name])));
}
</script>
