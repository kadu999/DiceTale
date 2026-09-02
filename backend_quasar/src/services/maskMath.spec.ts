import { describe, it, expect } from 'vitest';
import { interpolateStrokePoints, applyEraseToPixels } from './maskMath';

describe('maskMath', () => {
  it('interpolates between two distant points', () => {
    const pts = interpolateStrokePoints({ x: 0, y: 0 }, { x: 0, y: 0.1 }, 0.05);
    expect(pts.length).toBeGreaterThan(1);
  });

  it('returns single point for zero distance', () => {
    const pts = interpolateStrokePoints({ x: 0.5, y: 0.5 }, { x: 0.5, y: 0.5 }, 0.05);
    expect(pts).toHaveLength(1);
    expect(pts[0]).toEqual({ x: 0.5, y: 0.5 });
  });

  it('interpolates correct number of points', () => {
    const pts = interpolateStrokePoints({ x: 0, y: 0 }, { x: 0, y: 0.2 }, 0.05);
    expect(pts.length).toBe(5);
  });

  it('applies erase to pixel buffer', () => {
    const pixels = new Uint8ClampedArray(100 * 100 * 4);
    pixels.fill(255);
    applyEraseToPixels(pixels, 100, 100, { x: 50, y: 50 }, 10, 1);
    expect(pixels[(50 * 100 + 50) * 4 + 3]).toBeLessThan(255);
  });

  it('fully erases center pixel with hardness', () => {
    const pixels = new Uint8ClampedArray(100 * 100 * 4);
    pixels.fill(255);
    applyEraseToPixels(pixels, 100, 100, { x: 50, y: 50 }, 10, 1000);
    expect(pixels[(50 * 100 + 50) * 4 + 3]).toBe(0);
  });

  it('softens edge pixels less than center', () => {
    const pixels = new Uint8ClampedArray(100 * 100 * 4);
    pixels.fill(255);
    applyEraseToPixels(pixels, 100, 100, { x: 50, y: 50 }, 10, 1);
    const centerAlpha = pixels[(50 * 100 + 50) * 4 + 3];
    const midAlpha = pixels[(45 * 100 + 50) * 4 + 3];
    expect(midAlpha).toBeLessThan(255);
    expect(midAlpha).toBeGreaterThanOrEqual(centerAlpha);
  });

  it('ignores pixels outside image bounds', () => {
    const pixels = new Uint8ClampedArray(100 * 100 * 4);
    pixels.fill(255);
    applyEraseToPixels(pixels, 100, 100, { x: 0, y: 0 }, 10, 1);
    expect(pixels[(99 * 100 + 99) * 4 + 3]).toBe(255);
  });
});
