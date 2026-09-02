<template>
  <q-input
    v-model.number="inner"
    type="number"
    min="1"
    :max="max"
    outlined
    dense
    style="max-width: 80px"
    @blur="clamp"
    @change="clamp"
  />
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';

const props = withDefaults(defineProps<{ modelValue: number; max?: number }>(), {
  max: Infinity,
});
const emit = defineEmits<{ 'update:modelValue': [v: number] }>();

const inner = ref<number>(Math.max(1, Math.min(props.modelValue, props.max)));

watch(
  () => props.modelValue,
  (v) => {
    inner.value = Math.max(1, Math.min(v, props.max));
  },
);

function clamp(): void {
  const value = Number.isFinite(inner.value) ? inner.value : 1;
  const clamped = Math.max(1, Math.min(value, props.max));
  inner.value = clamped;
  emit('update:modelValue', clamped);
}
</script>
