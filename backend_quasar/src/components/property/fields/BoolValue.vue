<template>
  <div class="q-my-sm row items-center">
    <span class="text-caption q-mr-sm">{{ labelText }}</span>
    <q-toggle :model-value="model" @update:model-value="setValue" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useWsStore } from 'src/stores/wsStore';
import { setObjectBool } from 'src/services/protocol/commands';

const props = defineProps<{
  objectId: string;
  componentType: string;
  data: Record<string, unknown>;
  labelText: string;
}>();

const ws = useWsStore();

const model = computed(() => !!props.data.value);

function setValue(value: boolean): void {
  if (value === model.value) return;
  ws.send(setObjectBool(props.objectId, value));
}
</script>
