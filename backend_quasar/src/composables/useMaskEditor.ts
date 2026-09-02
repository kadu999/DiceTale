import { ref } from 'vue';
import type { Ref } from 'vue';
import type { Position, EraseStroke } from 'src/services/protocol/types';
import { interpolateStrokePoints, applyEraseToPixels } from 'src/services/maskMath';

export interface UseMaskEditorOptions {
  onStroke: (points: Position[], radius: number) => void;
}

export interface UseMaskEditorReturn {
  brushRadius: Ref<number>;
  isDrawing: Ref<boolean>;
  currentStroke: Ref<EraseStroke | null>;
  pixels: Ref<Uint8ClampedArray | null>;
  activePointerId: Ref<number | null>;
  init(width: number, height: number): void;
  start(event: PointerEvent): void;
  move(event: PointerEvent): void;
  end(event?: PointerEvent): void;
  cancel(): void;
}

export function useMaskEditor(
  canvasRef: Ref<HTMLCanvasElement | null>,
  options: UseMaskEditorOptions,
): UseMaskEditorReturn {
  const { onStroke } = options;

  const brushRadius = ref(48);
  const isDrawing = ref(false);
  const currentStroke = ref<EraseStroke | null>(null);
  const pixels = ref<Uint8ClampedArray | null>(null);
  const activePointerId = ref<number | null>(null);

  let canvasWidth = 0;
  let canvasHeight = 0;
  let canvasContext: CanvasRenderingContext2D | null = null;
  let imageData: ImageData | null = null;
  let lastPoint: Position | null = null;

  function render(): void {
    if (canvasContext && imageData) {
      canvasContext.putImageData(imageData, 0, 0);
    }
  }

  function applyPoint(normalized: Position, radiusNormalized: number): void {
    if (!pixels.value) return;
    const center = {
      x: normalized.x * canvasWidth,
      y: normalized.y * canvasHeight,
    };
    const radius = radiusNormalized * canvasWidth;
    applyEraseToPixels(pixels.value, canvasWidth, canvasHeight, center, radius, 1);
  }

  function clampNormalized(point: Position): Position {
    return {
      x: Math.max(0, Math.min(1, point.x)),
      y: Math.max(0, Math.min(1, point.y)),
    };
  }

  function toNormalized(event: PointerEvent): Position {
    const canvas = canvasRef.value;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) / rect.width,
      y: (event.clientY - rect.top) / rect.height,
    };
  }

  function init(width: number, height: number): void {
    const canvas = canvasRef.value;
    if (!canvas) return;

    canvas.width = width;
    canvas.height = height;
    canvasWidth = width;
    canvasHeight = height;

    canvasContext = canvas.getContext('2d');
    if (!canvasContext) return;

    imageData = canvasContext.createImageData(width, height);
    pixels.value = imageData.data;
    // 初始状态：黑色不透明（与旧项目一致，擦除后 alpha 降低透出地图）
    for (let i = 0; i < pixels.value.length; i += 4) {
      pixels.value[i] = 0;
      pixels.value[i + 1] = 0;
      pixels.value[i + 2] = 0;
      pixels.value[i + 3] = 255;
    }
    render();

    isDrawing.value = false;
    currentStroke.value = null;
    activePointerId.value = null;
    lastPoint = null;
  }

  function start(event: PointerEvent): void {
    if (event.button !== 0 || isDrawing.value) return;

    const canvas = canvasRef.value;
    if (!canvas) return;

    isDrawing.value = true;
    activePointerId.value = event.pointerId;
    if (canvas.setPointerCapture) {
      canvas.setPointerCapture(event.pointerId);
    }

    const point = clampNormalized(toNormalized(event));
    lastPoint = point;

    const radiusNormalized = brushRadius.value / canvasWidth;
    applyPoint(point, radiusNormalized);
    render();

    currentStroke.value = {
      points: [point],
      radius: radiusNormalized,
      softness: 1,
      done: false,
    };

    onStroke([point], radiusNormalized);
  }

  function move(event: PointerEvent): void {
    if (!isDrawing.value || activePointerId.value !== event.pointerId || !lastPoint) return;

    const point = clampNormalized(toNormalized(event));
    const step = (brushRadius.value / canvasWidth) / 2;
    const radiusNormalized = brushRadius.value / canvasWidth;

    const points = interpolateStrokePoints(lastPoint, point, step);
    for (const p of points) {
      applyPoint(p, radiusNormalized);
    }
    render();

    if (currentStroke.value) {
      currentStroke.value.points.push(...points);
    }
    onStroke(points, radiusNormalized);

    lastPoint = point;
  }

  function end(event?: PointerEvent): void {
    if (!isDrawing.value) return;
    if (event && activePointerId.value !== event.pointerId) return;

    const canvas = canvasRef.value;
    if (canvas?.releasePointerCapture && activePointerId.value !== null) {
      try {
        canvas.releasePointerCapture(activePointerId.value);
      } catch {
        // pointer may already be released
      }
    }

    if (currentStroke.value) {
      currentStroke.value.done = true;
    }

    isDrawing.value = false;
    activePointerId.value = null;
    lastPoint = null;
  }

  function cancel(): void {
    end();
  }

  return {
    brushRadius,
    isDrawing,
    currentStroke,
    pixels,
    activePointerId,
    init,
    start,
    move,
    end,
    cancel,
  };
}
