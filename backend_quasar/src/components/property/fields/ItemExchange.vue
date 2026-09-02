<template>
  <div class="q-my-sm">
    <div class="text-caption">
      {{ labelText }}
      <span v-if="itemName">：{{ itemName }}（剩余 {{ remainingText }}）</span>
    </div>

    <div v-if="!itemName" class="text-grey text-caption">道具未配置名称</div>
    <div v-else-if="players.length === 0" class="text-grey text-caption">暂无玩家</div>
    <div v-for="player in players" :key="player.playerId" class="property-distribute-line">
      <q-btn icon="remove" size="xs" flat dense @click="removeOne(player.playerId)" />
      <span class="property-distribute-name" :title="player.name || player.playerId">
        {{ player.name || player.playerId }}
      </span>
      <span class="property-distribute-count">{{ countOf(player.playerId) }}</span>
      <q-btn
        icon="add"
        size="xs"
        flat
        dense
        :disable="remaining <= 0"
        @click="addOne(player.playerId)"
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
  remainingCount,
} from 'src/services/inventory';
import { setObjectItems } from 'src/services/protocol/commands';

const props = defineProps<{
  objectId: string;
  componentType: string;
  data: Record<string, unknown>;
  labelText: string;
}>();

const ws = useWsStore();
const gameState = useGameStateStore();

const itemName = computed(() => (props.data.itemName as string) || '');

const quantity = computed(() => Number(props.data.quantity));

const players = computed(() =>
  Object.values(gameState.snapshot.players).sort((a, b) =>
    (a.name || a.playerId).localeCompare(b.name || b.playerId),
  ),
);

const stock = computed(() => {
  if (!itemName.value) return 0;
  const s = computeItemStock(gameState.snapshot.objects, itemName.value);
  return Number.isFinite(s) ? s : quantity.value;
});

const held = computed(() => {
  if (!itemName.value) return 0;
  return computeHeldCount(gameState.snapshot.objects, itemName.value);
});

const remaining = computed(() => {
  if (!itemName.value) return 0;
  return remainingCount(stock.value, held.value);
});

const remainingText = computed(() => (Number.isFinite(remaining.value) ? remaining.value : '∞'));

function playerItems(playerId: string): string[] {
  const obj = gameState.getObject(playerId);
  if (!obj?.componentData) return [];
  const blocks = parseComponentData(obj.componentData);
  const backpack = blocks?.find((b) => b.component === 'Backpack');
  return Array.isArray(backpack?.data.items) ? (backpack.data.items as string[]) : [];
}

function countOf(playerId: string): number {
  if (!itemName.value) return 0;
  return playerItems(playerId).filter((i) => i === itemName.value).length;
}

function removeOne(playerId: string): void {
  if (!itemName.value) return;
  const current = playerItems(playerId);
  const idx = current.indexOf(itemName.value);
  if (idx < 0) return;
  const next = current.slice();
  next.splice(idx, 1);
  ws.send(setObjectItems(playerId, next));
}

function addOne(playerId: string): void {
  if (!itemName.value || remaining.value <= 0) return;
  ws.send(setObjectItems(playerId, playerItems(playerId).concat([itemName.value])));
}
</script>
