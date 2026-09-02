<template>
  <div class="q-my-sm row items-center">
    <span class="text-caption q-mr-sm">{{ labelText }}</span>
    <q-btn icon="brush" label="编辑遮罩" size="sm" @click="open = true" />
    <mask-editor-dialog v-model="open" :object-id="objectId" />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import MaskEditorDialog from 'src/components/mask/MaskEditorDialog.vue';

defineProps<{
  objectId: string;
  componentType: string;
  data: Record<string, unknown>;
  labelText: string;
}>();

const open = ref(false);
</script>
