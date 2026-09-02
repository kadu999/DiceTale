<template>
  <div class="q-my-sm">
    <div class="text-caption">{{ labelText }}</div>
    <div class="q-gutter-sm">
      <q-btn
        v-for="opt in options"
        :key="opt"
        :label="opt"
        :color="opt === model ? 'primary' : 'grey-7'"
        size="sm"
        @click="setValue(opt)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useWsStore } from 'src/stores/wsStore';
import { setObjectOption } from 'src/services/protocol/commands';

const props = defineProps<{
  objectId: string;
  componentType: string;
  data: Record<string, unknown>;
  labelText: string;
}>();

const ws = useWsStore();

const options = computed(() =>
  Array.isArray(props.data.options) ? (props.data.options as string[]) : [],
);

const model = computed(() => (props.data.currentOption as string) || '');

function setValue(value: string): void {
  if (value === model.value) return;
  ws.send(setObjectOption(props.objectId, value));
}
</script>
