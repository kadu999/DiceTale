<template>
  <q-chip :color="chipColor" text-color="white" size="sm">
    {{ statusText }}
  </q-chip>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useWsStore } from 'src/stores/wsStore';

const ws = useWsStore();
const chipColor = computed(() => (ws.isConnected ? 'positive' : 'negative'));
const statusText = computed(() => (ws.isConnected ? '已连接' : '未连接'));
</script>
