<template>
  <q-dialog
    :model-value="modelValue"
    @update:model-value="onUpdate"
  >
    <q-card class="mask-editor-card">
      <q-card-section class="row items-center q-pb-none">
        <div class="text-h6">编辑遮罩</div>
        <q-space />
        <q-btn icon="close" flat round dense @click="close" />
      </q-card-section>

      <q-card-section>
        <div
          v-if="dims"
          class="mask-canvas-wrapper"
          :style="{ paddingTop: `${(dims.height / dims.width) * 100}%` }"
        >
          <img
            v-if="mapSrc"
            :src="mapSrc"
            class="mask-bg-image"
            alt="地图"
          />
          <canvas
            ref="canvasRef"
            class="mask-canvas"
            @pointerdown="editor.start"
            @pointermove="editor.move"
            @pointerup="editor.end"
            @pointercancel="editor.cancel"
          />
        </div>

        <div class="row items-center q-mt-sm q-gutter-md">
          <span class="text-caption">笔刷大小</span>
          <q-slider
            v-model="editor.brushRadius.value"
            :min="1"
            :max="200"
            label
            style="min-width: 200px"
          />
        </div>
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat label="关闭" @click="close" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch, nextTick } from 'vue';
import { useQuasar } from 'quasar';
import { useGameStateStore } from 'src/stores/gameStateStore';
import { useMapStore } from 'src/stores/mapStore';
import { useWsStore } from 'src/stores/wsStore';
import { parseComponentData } from 'src/services/gameState';
import { eraseMaskStroke } from 'src/services/protocol/commands';
import type { Position } from 'src/services/protocol/types';
import { useMaskEditor } from 'src/composables/useMaskEditor';

const props = defineProps<{
  modelValue: boolean;
  objectId: string;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
}>();

const $q = useQuasar();
const gameState = useGameStateStore();
const mapStore = useMapStore();
const ws = useWsStore();

const canvasRef = ref<HTMLCanvasElement | null>(null);
const dims = ref<{ width: number; height: number } | null>(null);

const object = computed(() => gameState.getObject(props.objectId));

const mapName = computed(() => object.value?.mapName || mapStore.effectiveMap);

const mapSrc = computed(() => {
  const name = mapName.value;
  return name ? `/maps/${encodeURIComponent(name)}.png` : '';
});

function onStroke(points: Position[], radius: number): void {
  ws.send(eraseMaskStroke(props.objectId, points, radius, 1));
}

const editor = useMaskEditor(canvasRef, { onStroke });

function close(): void {
  emit('update:modelValue', false);
}

function onUpdate(value: boolean): void {
  emit('update:modelValue', value);
}

function isValidMaskDimension(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value > 0 &&
    Number.isInteger(value) &&
    value <= 4096
  );
}

function resolveDimensions(): { width: number; height: number } | null {
  const obj = object.value;
  if (!obj) {
    $q.notify({ type: 'negative', message: '目标对象不存在' });
    return null;
  }

  const blocks = parseComponentData(obj.componentData ?? '');
  const block = blocks?.find((b) => b.component === 'MaskImage');
  const rawWidth = block?.data.maskWidth;
  const rawHeight = block?.data.maskHeight;

  if (!isValidMaskDimension(rawWidth) || !isValidMaskDimension(rawHeight)) {
    $q.notify({
      type: 'negative',
      message: '遮罩尺寸必须是 1 到 4096 之间的有限正整数',
    });
    return null;
  }

  return { width: rawWidth, height: rawHeight };
}

watch(
  () => props.modelValue,
  async (open) => {
    if (!open) {
      dims.value = null;
      return;
    }

    const resolved = resolveDimensions();
    if (!resolved) {
      close();
      return;
    }

    dims.value = resolved;
    await nextTick();
    editor.init(resolved.width, resolved.height);
  },
  { immediate: true },
);
</script>

<style scoped>
.mask-editor-card {
  width: 90vw;
  max-width: 960px;
}

.mask-canvas-wrapper {
  position: relative;
  width: 100%;
  background: #000;
}

.mask-bg-image {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.mask-canvas {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 100%;
  touch-action: none;
}
</style>
