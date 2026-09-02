<template>
  <div class="q-my-sm">
    <div class="text-caption">{{ labelText }}: {{ displayValue }}</div>
    <q-input
      v-model.number="inner"
      type="number"
      :step="1"
      :min="hasRange ? min : undefined"
      :max="hasRange ? max : undefined"
      outlined
      dense
      @change="apply"
    />
    <q-slider
      v-if="hasRange"
      v-model="inner"
      :min="min"
      :max="max"
      :step="1"
      @change="apply"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useWsStore } from 'src/stores/wsStore';
import { setObjectInt } from 'src/services/protocol/commands';

const props = defineProps<{
  objectId: string;
  componentType: string;
  data: Record<string, unknown>;
  labelText: string;
}>();

const ws = useWsStore();

const rawValue = computed(() => Number(props.data.value));
const min = computed(() => Number(props.data.min));
const max = computed(() => Number(props.data.max));

const hasRange = computed(
  () =>
    props.data.enableRange === true &&
    Number.isFinite(min.value) &&
    Number.isFinite(max.value) &&
    min.value < max.value,
);

const inner = ref(rawValue.value);

watch(rawValue, (v) => {
  inner.value = v;
});

const displayValue = computed(() => {
  const v = Number(inner.value);
  if (Number.isNaN(v)) return '-';
  if (!hasRange.value) return v;
  return Math.min(Math.max(v, min.value), max.value);
});

function apply(): void {
  let v = Number(inner.value);
  if (Number.isNaN(v)) return;
  if (hasRange.value) {
    v = Math.max(min.value, Math.min(max.value, v));
  }
  v = Math.round(v);
  inner.value = v;
  ws.send(setObjectInt(props.objectId, v));
}
</script>
