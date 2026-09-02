export interface Position {
  x: number;
  y: number;
}

export function interpolateStrokePoints(a: Position, b: Position, step: number): Position[] {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist === 0) return [a];
  const count = Math.max(1, Math.ceil(dist / step));
  const points: Position[] = [];
  for (let i = 0; i <= count; i++) {
    const t = i / count;
    points.push({ x: a.x + dx * t, y: a.y + dy * t });
  }
  return points;
}

export function applyEraseToPixels(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  center: { x: number; y: number },
  radius: number,
  softness: number,
): void {
  const r2 = radius * radius;
  const x0 = Math.max(0, Math.floor(center.x - radius));
  const x1 = Math.min(width - 1, Math.ceil(center.x + radius));
  const y0 = Math.max(0, Math.floor(center.y - radius));
  const y1 = Math.min(height - 1, Math.ceil(center.y + radius));

  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = x - center.x;
      const dy = y - center.y;
      const d2 = dx * dx + dy * dy;
      if (d2 > r2) continue;
      const d = Math.sqrt(d2);
      const factor = Math.min(1, d / radius); // 0 at center, 1 at edge
      const alpha = Math.pow(1 - factor, softness + 0.001);
      const idx = (y * width + x) * 4 + 3;
      pixels[idx] = Math.min(pixels[idx], Math.round((1 - alpha) * 255));
    }
  }
}
