<template>
  <q-dialog :model-value="modelValue" @update:model-value="onUpdate">
    <q-card class="picker-card">
      <q-card-section class="row items-center q-pb-none">
        <div class="text-h6">选择道具</div>
        <q-space />
        <q-btn icon="close" flat round dense @click="close" />
      </q-card-section>

      <q-card-section class="q-pt-sm picker-body">
        <div class="row q-col-gutter-sm full-height">
          <!-- 类型 -->
          <div class="col-12 col-sm-2">
            <div class="picker-column">
              <div class="picker-header">类型</div>
              <q-list dense bordered separator class="rounded-borders picker-list">
                <q-item
                  clickable
                  :active="category === ''"
                  active-class="bg-primary text-white"
                  @click="category = ''"
                >
                  <q-item-section>全部</q-item-section>
                </q-item>
                <q-item
                  v-for="c in categories"
                  :key="c"
                  clickable
                  :active="category === c"
                  active-class="bg-primary text-white"
                  @click="category = c"
                >
                  <q-item-section>{{ c }}</q-item-section>
                </q-item>
              </q-list>
            </div>
          </div>

          <!-- 道具 -->
          <div class="col-12 col-sm-6">
            <div class="picker-column">
              <div class="picker-header">道具</div>
              <q-input
                v-model="search"
                dense
                outlined
                clearable
                placeholder="搜索道具名 / 类别"
                class="q-mb-sm"
              >
                <template #prepend>
                  <q-icon name="search" />
                </template>
              </q-input>

              <div class="item-grid">
                <button
                  v-for="item in filteredItems"
                  :key="item.name"
                  type="button"
                  class="item-cell"
                  :class="{
                    selected: selected === item.name,
                    disabled: !canAddCell(item.name),
                  }"
                  :disabled="!canAddCell(item.name)"
                  @click="select(item.name)"
                >
                  <span class="item-cell-name">{{ item.name }}</span>
                  <span class="item-cell-price">{{ formatPrice(item.price) }}</span>
                </button>
                <div
                  v-if="filteredItems.length === 0"
                  class="text-grey text-caption q-pa-sm empty-hint"
                >
                  无匹配道具
                </div>
              </div>
            </div>
          </div>

          <!-- 道具属性 -->
          <div class="col-12 col-sm-4">
            <div class="picker-column">
              <div class="picker-header">道具属性</div>
              <div v-if="!selectedItem" class="text-grey text-caption q-pa-sm empty-hint">
                点击左侧道具查看属性
              </div>
              <template v-else>
                <div class="property-row">
                  <span class="property-label">类别</span>
                  <span class="property-value">{{ selectedItem.category || '—' }}</span>
                </div>
                <div class="property-row">
                  <span class="property-label">价格</span>
                  <span class="property-value">{{ formatPrice(selectedItem.price) }}</span>
                </div>
                <div class="property-row">
                  <span class="property-label">鉴定</span>
                  <span class="property-value">{{ selectedItem.identify ? '是' : '—' }}</span>
                </div>
                <div class="property-row">
                  <span class="property-label">模组用途</span>
                  <span class="property-value">{{ selectedItem.usage || '—' }}</span>
                </div>

                <div class="property-row q-mt-sm">
                  <span class="property-label">数量</span>
                  <item-quantity-input v-model="quantity" :max="99" />
                </div>
                <div class="text-caption text-grey q-mt-xs">
                  可添加 {{ formatRemaining(remainingOf(selected)) }}
                </div>
              </template>
            </div>
          </div>
        </div>
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat label="取消" @click="close" />
        <q-btn
          color="primary"
          :label="confirmLabel"
          :disable="!canConfirm"
          data-testid="confirm-add"
          @click="confirm"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useQuasar } from 'quasar';
import { useItemsStore } from 'src/stores/itemsStore';
import { useGameStateStore } from 'src/stores/gameStateStore';
import { useWsStore } from 'src/stores/wsStore';
import { parseComponentData } from 'src/services/gameState';
import {
  computeItemStock,
  computeHeldCount,
  canAddItem,
  remainingCount,
} from 'src/services/inventory';
import { setObjectItems } from 'src/services/protocol/commands';
import ItemQuantityInput from './ItemQuantityInput.vue';

const props = defineProps<{ modelValue: boolean; objectId: string }>();
const emit = defineEmits<{ 'update:modelValue': [v: boolean] }>();

const $q = useQuasar();
const itemsStore = useItemsStore();
const gameState = useGameStateStore();
const ws = useWsStore();

const search = ref('');
const category = ref('');
const selected = ref<string | null>(null);
const quantity = ref(1);

const categories = computed(() =>
  [...new Set(itemsStore.catalog.map((item) => item.category).filter((c): c is string => Boolean(c)))].sort(),
);

const filteredItems = computed(() => {
  const term = search.value.trim().toLowerCase();
  return itemsStore.catalog.filter((item) => {
    if (category.value && (item.category || '—') !== category.value) return false;
    if (!term) return true;
    return (
      (item.name || '').toLowerCase().includes(term) ||
      (item.category || '').toLowerCase().includes(term)
    );
  });
});

const selectedItem = computed(() =>
  selected.value ? itemsStore.catalog.find((item) => item.name === selected.value) ?? null : null,
);

function remainingOf(itemName: string | null): number {
  if (!itemName) return 0;
  const stock = computeItemStock(gameState.snapshot.objects, itemName);
  const held = computeHeldCount(gameState.snapshot.objects, itemName);
  return remainingCount(stock, held);
}

function canAddCell(itemName: string): boolean {
  return remainingOf(itemName) > 0;
}

function formatRemaining(value: number): string | number {
  return Number.isFinite(value) ? value : '∞';
}

function formatPrice(value: number | null | undefined): string {
  if (value == null) return '价格自定';
  const n = Number(value);
  if (!Number.isFinite(n)) return '价格自定';
  return '$' + String(Number(n.toFixed(2)));
}

function select(name: string): void {
  selected.value = name;
  quantity.value = 1;
}

const canConfirm = computed(() => {
  if (!selected.value) return false;
  const stock = computeItemStock(gameState.snapshot.objects, selected.value);
  const held = computeHeldCount(gameState.snapshot.objects, selected.value);
  return canAddItem(stock, held, quantity.value);
});

const confirmLabel = computed(() => {
  if (!selected.value || quantity.value <= 1) return '确定';
  return `确定（×${quantity.value}）`;
});

function close(): void {
  emit('update:modelValue', false);
}

function onUpdate(value: boolean): void {
  emit('update:modelValue', value);
}

function confirm(): void {
  if (!selected.value || !canConfirm.value) return;

  const obj = gameState.getObject(props.objectId);
  if (!obj) {
    $q.notify({ type: 'negative', message: '目标对象不存在' });
    return;
  }

  const blocks = parseComponentData(obj.componentData);
  const backpack = blocks?.find((b) => b.component === 'Backpack');
  const current = Array.isArray(backpack?.data.items) ? (backpack.data.items as string[]) : [];
  const additions = Array.from({ length: quantity.value }, () => selected.value as string);

  ws.send(setObjectItems(props.objectId, current.concat(additions)));
  close();
}

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      search.value = '';
      category.value = '';
      selected.value = null;
      quantity.value = 1;
    }
  },
);
</script>

<style scoped>
.picker-card {
  /* 桌面端固定 16:9 长宽比，避免弹框随内容变得太扁/太长；
     移动端直接撑满可用空间，保证可读性。 */
  width: 90vw;
  max-width: 90vw;
  height: 85vh;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
}

@media (min-width: 576px) {
  .picker-card {
    width: min(90vw, calc(85vh * 16 / 9));
    height: min(85vh, calc(90vw * 9 / 16));
  }
}

.picker-body {
  min-height: 0;
  flex: 1 1 auto;
  overflow: hidden;
}

.picker-body > .row {
  height: 100%;
  min-height: 0;
}

.picker-column {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.picker-header {
  font-size: 0.85rem;
  font-weight: 700;
  color: #94a3b8;
  text-align: center;
  padding: 0.25rem 0;
  margin-bottom: 0.25rem;
}

.picker-list {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
}

.item-grid {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(72px, 1fr));
  grid-auto-rows: 72px;
  gap: 0.5rem;
  align-content: start;
  padding-right: 4px;
}

.item-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  padding: 0.35rem;
  border: 1px solid #495057;
  border-radius: 8px;
  background: #1e293b;
  color: #e2e8f0;
  cursor: pointer;
  text-align: center;
  overflow: hidden;
}

.item-cell:hover:not(:disabled) {
  background: #2b3035;
  border-color: #6c757d;
}

.item-cell.selected {
  background: #1976d2;
  border-color: #1976d2;
  color: #fff;
}

.item-cell.selected .item-cell-price {
  color: #dbeafe;
}

.item-cell:disabled,
.item-cell.disabled {
  opacity: 0.4;
  cursor: default;
}

.item-cell-name {
  font-size: 0.75rem;
  line-height: 1.25;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  word-break: break-all;
}

.item-cell-price {
  font-size: 0.65rem;
  color: #94a3b8;
}

.empty-hint {
  grid-column: 1 / -1;
}

.property-row {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 0.25rem 0;
  font-size: 0.9rem;
}

.property-label {
  flex: 0 0 auto;
  min-width: 4.5em;
  color: #94a3b8;
}

.property-value {
  flex: 1 1 auto;
  min-width: 0;
  font-weight: 600;
  color: #e2e8f0;
  word-break: break-all;
}
</style>
