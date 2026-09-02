import { computed } from 'vue';
import type { Ref } from 'vue';
import type { Position } from 'src/services/protocol/types';
import type { ImageRect } from 'src/services/mapCoordinates';
import { computeImageRect, normalizedToPixel } from 'src/services/mapCoordinates';

export interface UseMapCoordinatesReturn {
  imageRect: ReturnType<typeof computed<ImageRect | null>>;
  positionToStyle: (pos: Position | null | undefined) => Record<string, string> | null;
}

export function useMapCoordinates(
  containerRef: Ref<HTMLElement | null>,
  imageRef: Ref<HTMLImageElement | null>,
  trigger: Ref<number>,
): UseMapCoordinatesReturn {
  const imageRect = computed<ImageRect | null>(() => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _tick = trigger.value;
    const container = containerRef.value;
    const img = imageRef.value;
    if (!container || !img) return null;
    return computeImageRect(
      container.clientWidth,
      container.clientHeight,
      img.naturalWidth,
      img.naturalHeight,
    );
  });

  function positionToStyle(pos: Position | null | undefined): Record<string, string> | null {
    const rect = imageRect.value;
    if (!rect || !pos) return null;
    const pixel = normalizedToPixel(pos, rect);
    return { left: `${pixel.x}px`, top: `${pixel.y}px` };
  }

  return { imageRect, positionToStyle };
}
