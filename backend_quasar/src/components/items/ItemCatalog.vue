<template>
  <!-- 中列：道具显示（搜索 + 网格，布局参考旧项目 itemPickerModal 的“道具”列）
       catalog-root 撑满面板高度，网格超出时在面板内滚动 -->
  <div class="catalog-root">
    <q-input
      v-model="itemsStore.search"
      dense
      outlined
      clearable
      placeholder="搜索道具名"
    >
      <template #prepend>
        <q-icon name="search" />
      </template>
    </q-input>

    <div class="item-grid q-mt-sm">
      <button
        v-for="item in itemsStore.filteredItems"
        :key="item.name"
        type="button"
        class="item-cell"
        :class="{ selected: selectedItem === item.name }"
        @click="select(item.name)"
      >
        <span class="item-cell-name">{{ item.name }}</span>
        <span class="item-cell-price">{{ formatPrice(item.price) }}</span>
      </button>
      <div
        v-if="itemsStore.filteredItems.length === 0"
        class="text-grey text-caption q-pa-sm"
        style="grid-column: 1 / -1"
      >
        无匹配道具
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useItemsStore } from 'src/stores/itemsStore';

defineProps<{ selectedItem?: string }>();
const emit = defineEmits<{ select: [name: string] }>();

const itemsStore = useItemsStore();

function select(name: string): void {
  emit('select', name);
}

function formatPrice(value: number | null | undefined): string {
  if (value == null) return '价格自定';
  const n = Number(value);
  if (!Number.isFinite(n)) return '价格自定';
  return '$' + String(Number(n.toFixed(2)));
}
</script>

<style scoped>
.catalog-root {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.catalog-root .item-grid {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
}
</style>
