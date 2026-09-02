import { describe, it, expect, beforeEach, vi } from 'vitest';
import { nextTick, ref } from 'vue';
import { useMaskEditor } from './useMaskEditor';
import type { Position } from 'src/services/protocol/types';

function createPointerEvent(
  canvas: HTMLCanvasElement,
  overrides: { clientX?: number; clientY?: number; pointerId?: number; button?: number } = {},
): PointerEvent {
  const rect = canvas.getBoundingClientRect();
  return {
    clientX: rect.left + (overrides.clientX ?? rect.width / 2),
    clientY: rect.top + (overrides.clientY ?? rect.height / 2),
    pointerId: overrides.pointerId ?? 1,
    button: overrides.button ?? 0,
  } as unknown as PointerEvent;
}

describe('useMaskEditor', () => {
  function createFakeContext(width: number, height: number) {
    const data = new Uint8ClampedArray(width * height * 4);
    const imageData =
      typeof ImageData !== 'undefined'
        ? new ImageData(data, width, height)
        : ({ data, width, height } as unknown as ImageData);
    return {
      createImageData: () => imageData,
      putImageData: () => {
        // no-op in unit tests
      },
    } as unknown as CanvasRenderingContext2D;
  }

  function setup() {
    const canvas = document.createElement('canvas');
    Object.defineProperty(canvas, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: 200, height: 100 }),
      configurable: true,
    });
    Object.defineProperty(canvas, 'getContext', {
      value: () => createFakeContext(canvas.width || 100, canvas.height || 50),
      configurable: true,
    });
    const canvasRef = ref(canvas);
    const strokes: Array<{ points: Position[]; radius: number }> = [];
    const editor = useMaskEditor(canvasRef, {
      onStroke: (points, radius) => strokes.push({ points, radius }),
    });
    editor.init(100, 50);
    return { canvas, canvasRef, editor, strokes };
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initializes pixel buffer to opaque black', () => {
    const { editor } = setup();
    expect(editor.pixels.value).not.toBeNull();
    expect(editor.pixels.value!.length).toBe(100 * 50 * 4);
    for (let i = 0; i < editor.pixels.value!.length; i += 4) {
      expect(editor.pixels.value![i]).toBe(0);
      expect(editor.pixels.value![i + 1]).toBe(0);
      expect(editor.pixels.value![i + 2]).toBe(0);
      expect(editor.pixels.value![i + 3]).toBe(255);
    }
  });

  it('starts a stroke on primary button pointerdown', async () => {
    const { canvas, editor, strokes } = setup();
    const event = createPointerEvent(canvas, { clientX: 100, clientY: 50 });
    editor.start(event);
    await nextTick();
    expect(editor.isDrawing.value).toBe(true);
    expect(strokes.length).toBe(1);
    expect(strokes[0].points.length).toBe(1);
    expect(strokes[0].points[0]).toEqual({ x: 0.5, y: 0.5 });
    expect(strokes[0].radius).toBe(48 / 100);
  });

  it('ignores non-primary button pointerdown', () => {
    const { canvas, editor, strokes } = setup();
    const event = createPointerEvent(canvas, { button: 2 });
    editor.start(event);
    expect(editor.isDrawing.value).toBe(false);
    expect(strokes.length).toBe(0);
  });

  it('ignores pointerdown when already drawing', () => {
    const { canvas, editor, strokes } = setup();
    editor.start(createPointerEvent(canvas, { pointerId: 1 }));
    editor.start(createPointerEvent(canvas, { pointerId: 2 }));
    expect(strokes.length).toBe(1);
    expect(editor.activePointerId.value).toBe(1);
  });

  it('emits interpolated points on pointermove and applies erase locally', async () => {
    const { canvas, editor, strokes } = setup();
    editor.start(createPointerEvent(canvas, { clientX: 0, clientY: 0 }));
    editor.move(createPointerEvent(canvas, { clientX: 200, clientY: 100 }));
    await nextTick();
    expect(strokes.length).toBe(2);
    expect(strokes[1].points.length).toBeGreaterThan(1);
    expect(editor.pixels.value![(25 * 100 + 50) * 4 + 3]).toBeLessThan(255);
  });

  it('ignores move events from a different pointer id', () => {
    const { canvas, editor, strokes } = setup();
    editor.start(createPointerEvent(canvas, { pointerId: 1, clientX: 0, clientY: 0 }));
    editor.move(createPointerEvent(canvas, { pointerId: 2, clientX: 200, clientY: 100 }));
    expect(strokes.length).toBe(1);
  });

  it('ends the stroke on pointerup and clears active pointer', () => {
    const { canvas, editor } = setup();
    editor.start(createPointerEvent(canvas));
    editor.end(createPointerEvent(canvas));
    expect(editor.isDrawing.value).toBe(false);
    expect(editor.activePointerId.value).toBeNull();
    expect(editor.currentStroke.value?.done).toBe(true);
  });

  it('cancels the current stroke', () => {
    const { canvas, editor } = setup();
    editor.start(createPointerEvent(canvas));
    editor.cancel();
    expect(editor.isDrawing.value).toBe(false);
  });

  it('clamps normalized coordinates to [0, 1]', () => {
    const { canvas, editor, strokes } = setup();
    editor.start(createPointerEvent(canvas, { clientX: -100, clientY: 200 }));
    expect(strokes[0].points[0].x).toBe(0);
    expect(strokes[0].points[0].y).toBe(1);
  });
});
