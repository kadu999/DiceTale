import { describe, it, expect } from 'vitest';
import { computeImageRect, normalizedToPixel, pixelToNormalized } from './mapCoordinates';

describe('mapCoordinates', () => {
  it('converts normalized to pixel', () => {
    const rect = { x: 0, y: 0, width: 100, height: 100 };
    expect(normalizedToPixel({ x: 0.5, y: 0.5 }, rect)).toEqual({ x: 50, y: 50 });
  });

  it('converts pixel to normalized', () => {
    const rect = { x: 0, y: 0, width: 100, height: 100 };
    expect(pixelToNormalized({ x: 50, y: 50 }, rect)).toEqual({ x: 0.5, y: 0.5 });
  });

  it('handles contain fit with equal aspect ratio', () => {
    const rect = computeImageRect(200, 100, 100, 100);
    expect(rect).not.toBeNull();
    expect(rect!.width).toBe(100);
    expect(rect!.height).toBe(100);
    expect(rect!.x).toBe(50);
    expect(rect!.y).toBe(0);
  });

  it('handles contain fit with letterboxing', () => {
    const rect = computeImageRect(200, 100, 200, 100);
    expect(rect).not.toBeNull();
    expect(rect!.width).toBe(200);
    expect(rect!.height).toBe(100);
    expect(rect!.x).toBe(0);
    expect(rect!.y).toBe(0);
  });

  it('handles contain fit with pillarboxing', () => {
    const rect = computeImageRect(100, 200, 100, 50);
    expect(rect).not.toBeNull();
    expect(rect!.width).toBe(100);
    expect(rect!.height).toBe(50);
    expect(rect!.x).toBe(0);
    expect(rect!.y).toBe(75);
  });

  it('returns null when container is hidden', () => {
    expect(computeImageRect(0, 100, 100, 100)).toBeNull();
    expect(computeImageRect(100, 0, 100, 100)).toBeNull();
  });

  it('returns null when natural size is zero', () => {
    expect(computeImageRect(100, 100, 0, 100)).toBeNull();
    expect(computeImageRect(100, 100, 100, 0)).toBeNull();
  });
});
