<template>
  <!-- 右上：选中道具的属性（布局参考旧项目 itemPickerModal 的“道具属性”列） -->
  <div v-if="!entry" class="text-grey text-caption">点击中间道具查看属性</div>
  <template v-else>
    <div class="property-row">
      <span class="property-label">类别</span>
      <span class="property-value">{{ entry.category || '—' }}</span>
    </div>
    <div class="property-row">
      <span class="property-label">价格</span>
      <span class="property-value">{{ formatPrice(entry.price) }}</span>
    </div>
    <div class="property-row">
      <span class="property-label">鉴定</span>
      <span class="property-value">{{ entry.identify ? '是' : '—' }}</span>
    </div>
    <div class="property-row">
      <span class="property-label">模组用途</span>
      <span class="property-value">{{ entry.usage || '—' }}</span>
    </div>
    <div class="property-row">
      <span class="property-label">库存</span>
      <span class="property-value">{{ formatStock(itemsStore.stockOf(entry.name)) }}</span>
    </div>
    <div class="property-row">
      <span class="property-label">剩余可分配</span>
      <span class="property-value">{{ formatStock(remainingOf(entry.name)) }}</span>
    </div>
  </template>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useItemsStore } from 'src/stores/itemsStore';
import { remainingCount } from 'src/services/inventory';

const props = defineProps<{ itemName?: string }>();

const itemsStore = useItemsStore();

const entry = computed(() =>
  props.itemName ? itemsStore.catalog.find((item) => item.name === props.itemName) ?? null : null,
);

function remainingOf(name: string): number {
  return remainingCount(itemsStore.stockOf(name), itemsStore.heldOf(name));
}

function formatStock(stock: number): string | number {
  return Number.isFinite(stock) ? stock : '∞';
}

function formatPrice(value: number | null | undefined): string {
  if (value == null) return '价格自定';
  const n = Number(value);
  if (!Number.isFinite(n)) return '价格自定';
  return '$' + String(Number(n.toFixed(2)));
}
</script>
