import { describe, it, expect } from 'vitest';
import { computeItemStock, computeHeldCount, canAddItem, remainingCount } from './inventory';
import type { ObjectInfo } from './protocol/types';

describe('inventory', () => {
  it('computes stock across all ItemExchange components', () => {
    const objects: Record<string, ObjectInfo> = {
      o1: {
        objectId: 'o1',
        componentData: '[{"component":"ItemExchange","data":{"itemName":"Potion","quantity":5}}]',
      },
      o2: {
        objectId: 'o2',
        componentData: '[{"component":"ItemExchange","data":{"itemName":"Potion","quantity":3}}]',
      },
    };
    expect(computeItemStock(objects, 'Potion')).toBe(8);
  });

  it('computes held count across all Backpack components', () => {
    const objects: Record<string, ObjectInfo> = {
      o1: {
        objectId: 'o1',
        componentData: '[{"component":"Backpack","data":{"items":["Potion","Potion"]}}]',
      },
    };
    expect(computeHeldCount(objects, 'Potion')).toBe(2);
  });

  it('computes held count across multiple objects', () => {
    const objects: Record<string, ObjectInfo> = {
      o1: {
        objectId: 'o1',
        componentData: '[{"component":"Backpack","data":{"items":["Potion"]}}]',
      },
      o2: {
        objectId: 'o2',
        componentData: '[{"component":"Backpack","data":{"items":["Potion","Sword"]}}]',
      },
    };
    expect(computeHeldCount(objects, 'Potion')).toBe(2);
  });

  it('returns Infinity for stock when no source configured', () => {
    expect(computeItemStock({}, 'Potion')).toBe(Infinity);
  });

  it('ignores quantity <= 0 in stock', () => {
    const objects: Record<string, ObjectInfo> = {
      o1: {
        objectId: 'o1',
        componentData: '[{"component":"ItemExchange","data":{"itemName":"Potion","quantity":0}}]',
      },
      o2: {
        objectId: 'o2',
        componentData: '[{"component":"ItemExchange","data":{"itemName":"Potion","quantity":-1}}]',
      },
    };
    expect(computeItemStock(objects, 'Potion')).toBe(Infinity);
  });

  it('computes remaining count', () => {
    expect(remainingCount(10, 3)).toBe(7);
    expect(remainingCount(10, 10)).toBe(0);
    expect(remainingCount(10, 15)).toBe(0);
  });

  it('returns Infinity remaining when stock is Infinity', () => {
    expect(remainingCount(Infinity, 100)).toBe(Infinity);
  });

  it('determines if items can be added', () => {
    expect(canAddItem(10, 3, 5)).toBe(true);
    expect(canAddItem(10, 3, 8)).toBe(false);
    expect(canAddItem(Infinity, 100, 5)).toBe(true);
    expect(canAddItem(10, 3, 0)).toBe(false);
    expect(canAddItem(10, 3, -1)).toBe(false);
  });
});
