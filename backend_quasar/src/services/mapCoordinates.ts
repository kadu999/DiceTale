export interface ImageRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function computeImageRect(
  containerWidth: number,
  containerHeight: number,
  naturalWidth: number,
  naturalHeight: number,
): ImageRect | null {
  if (!containerWidth || !containerHeight || !naturalWidth || !naturalHeight) return null;
  const containerRatio = containerWidth / containerHeight;
  const imageRatio = naturalWidth / naturalHeight;
  let width: number;
  let height: number;
  if (containerRatio > imageRatio) {
    height = containerHeight;
    width = height * imageRatio;
  } else {
    width = containerWidth;
    height = width / imageRatio;
  }
  const x = (containerWidth - width) / 2;
  const y = (containerHeight - height) / 2;
  return { x, y, width, height };
}

export function normalizedToPixel(
  position: { x: number; y: number },
  rect: ImageRect,
): { x: number; y: number } {
  return {
    x: rect.x + position.x * rect.width,
    y: rect.y + position.y * rect.height,
  };
}

export function pixelToNormalized(
  pixel: { x: number; y: number },
  rect: ImageRect,
): { x: number; y: number } {
  return {
    x: (pixel.x - rect.x) / rect.width,
    y: (pixel.y - rect.y) / rect.height,
  };
}
