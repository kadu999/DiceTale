import type { ObjectInfo } from './protocol/types';
import { parseComponentData } from './gameState';

export function computeItemStock(objects: Record<string, ObjectInfo>, itemName: string): number {
  let total = 0;
  let hasSource = false;
  for (const obj of Object.values(objects)) {
    const blocks = parseComponentData(obj.componentData ?? '');
    for (const block of blocks ?? []) {
      if (block.component === 'ItemExchange' && block.data.itemName === itemName) {
        const q = Number(block.data.quantity);
        if (Number.isFinite(q) && q > 0) {
          total += q;
          hasSource = true;
        }
      }
    }
  }
  return hasSource ? total : Infinity;
}

export function computeHeldCount(objects: Record<string, ObjectInfo>, itemName: string): number {
  let count = 0;
  for (const obj of Object.values(objects)) {
    const blocks = parseComponentData(obj.componentData ?? '');
    for (const block of blocks ?? []) {
      if (block.component === 'Backpack') {
        const items = Array.isArray(block.data.items) ? block.data.items : [];
        count += items.filter((i: unknown) => i === itemName).length;
      }
    }
  }
  return count;
}

export function remainingCount(stock: number, held: number): number {
  if (!Number.isFinite(stock)) return Infinity;
  return Math.max(0, stock - held);
}

export function canAddItem(stock: number, held: number, adding: number): boolean {
  if (adding <= 0) return false;
  if (!Number.isFinite(stock)) return true;
  return held + adding <= stock;
}
