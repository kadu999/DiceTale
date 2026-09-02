import { EraseStroke } from '../types';

/**
 * 消息字段的最小运行时校验：JSON.parse 出的数据不可信，TS 类型只在编译期生效。
 * 校验失败的消息由 handler 打日志后丢弃，不进入状态。
 */

export function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0;
}

export function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

/** 归一化图片坐标 [0,1]，y 向下。 */
export function isPosition(p: unknown): p is { x: number; y: number } {
  if (typeof p !== 'object' || p === null) return false;
  const { x, y } = p as { x?: unknown; y?: unknown };
  return isFiniteNumber(x) && isFiniteNumber(y) && x >= 0 && x <= 1 && y >= 0 && y <= 1;
}

export function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((it) => typeof it === 'string');
}

/** 遮罩笔画最小校验：轨迹点数组 + 有限半径/软边（点坐标细节由客户端 shader 消化，这里只挡畸形结构）。 */
export function isEraseStroke(s: unknown): s is EraseStroke {
  if (typeof s !== 'object' || s === null) return false;
  const { points, radius, softness } = s as Partial<EraseStroke>;
  return Array.isArray(points) && isFiniteNumber(radius) && isFiniteNumber(softness);
}
