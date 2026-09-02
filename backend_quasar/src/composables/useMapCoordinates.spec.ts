import { describe, it, expect } from 'vitest';
import { nextTick, ref } from 'vue';
import { useMapCoordinates } from './useMapCoordinates';

function createContainer(width: number, height: number): HTMLElement {
  const el = document.createElement('div');
  Object.defineProperty(el, 'clientWidth', { value: width, configurable: true });
  Object.defineProperty(el, 'clientHeight', { value: height, configurable: true });
  return el;
}

function createImage(naturalWidth: number, naturalHeight: number): HTMLImageElement {
  const img = document.createElement('img');
  Object.defineProperty(img, 'naturalWidth', { value: naturalWidth, configurable: true });
  Object.defineProperty(img, 'naturalHeight', { value: naturalHeight, configurable: true });
  return img;
}

describe('useMapCoordinates', () => {
  it('returns null rect when image has no natural size', async () => {
    const container = ref(createContainer(200, 100));
    const image = ref(createImage(0, 0));
    const tick = ref(0);
    const { imageRect } = useMapCoordinates(container, image, tick);
    await nextTick();
    expect(imageRect.value).toBeNull();
  });

  it('computes image rect for contain fit', async () => {
    const container = ref(createContainer(200, 100));
    const image = ref(createImage(100, 100));
    const tick = ref(0);
    const { imageRect } = useMapCoordinates(container, image, tick);
    tick.value += 1;
    await nextTick();
    const rect = imageRect.value;
    expect(rect).not.toBeNull();
    expect(rect!.width).toBe(100);
    expect(rect!.height).toBe(100);
    expect(rect!.x).toBe(50);
  });

  it('converts normalized position to style', async () => {
    const container = ref(createContainer(200, 100));
    const image = ref(createImage(100, 100));
    const tick = ref(0);
    const { positionToStyle } = useMapCoordinates(container, image, tick);
    tick.value += 1;
    await nextTick();
    const style = positionToStyle({ x: 0.5, y: 0.5 });
    expect(style).toEqual({ left: '100px', top: '50px' });
  });

  it('returns null style when position is missing', async () => {
    const container = ref(createContainer(200, 100));
    const image = ref(createImage(100, 100));
    const tick = ref(0);
    const { positionToStyle } = useMapCoordinates(container, image, tick);
    tick.value += 1;
    await nextTick();
    expect(positionToStyle(null)).toBeNull();
    expect(positionToStyle(undefined)).toBeNull();
  });

  it('recalculates when trigger changes', async () => {
    const container = ref(createContainer(200, 100));
    const image = ref(createImage(100, 100));
    const tick = ref(0);
    const { imageRect } = useMapCoordinates(container, image, tick);
    tick.value += 1;
    await nextTick();
    expect(imageRect.value).not.toBeNull();
    Object.defineProperty(container.value, 'clientWidth', { value: 400, configurable: true });
    tick.value += 1;
    await nextTick();
    expect(imageRect.value!.x).toBe(150);
  });
});
