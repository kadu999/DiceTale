import { describe, it, expect } from 'vitest';
import {
  setObjectOption,
  setObjectInt,
  setObjectFloat,
  setObjectBool,
  setObjectItems,
  eraseMaskStroke,
} from './commands';

describe('commands', () => {
  it('setObjectOption builds message', () => {
    expect(setObjectOption('o1', 'on')).toEqual({
      type: 'gm_set_option',
      objectId: 'o1',
      option: 'on',
    });
  });

  it('setObjectInt clamps value to range', () => {
    expect(setObjectInt('o1', 999, 0, 100)).toEqual({
      type: 'gm_set_int',
      objectId: 'o1',
      value: 100,
    });
  });

  it('setObjectInt clamps to min', () => {
    expect(setObjectInt('o1', -10, 0, 100)).toEqual({
      type: 'gm_set_int',
      objectId: 'o1',
      value: 0,
    });
  });

  it('setObjectInt leaves value unchanged without bounds', () => {
    expect(setObjectInt('o1', 42)).toEqual({
      type: 'gm_set_int',
      objectId: 'o1',
      value: 42,
    });
  });

  it('setObjectInt rounds fractional values', () => {
    expect(setObjectInt('o1', 1.6)).toEqual({
      type: 'gm_set_int',
      objectId: 'o1',
      value: 2,
    });
  });

  it('setObjectFloat clamps value to range', () => {
    expect(setObjectFloat('o1', 2.5, 0, 1)).toEqual({
      type: 'gm_set_float',
      objectId: 'o1',
      value: 1,
    });
  });

  it('setObjectBool builds message', () => {
    expect(setObjectBool('o1', true)).toEqual({
      type: 'gm_set_bool',
      objectId: 'o1',
      value: true,
    });
  });

  it('setObjectItems builds message', () => {
    expect(setObjectItems('o1', ['sword', 'shield'])).toEqual({
      type: 'gm_set_object_items',
      objectId: 'o1',
      items: ['sword', 'shield'],
    });
  });

  it('eraseMaskStroke builds valid message', () => {
    const msg = eraseMaskStroke(
      'o1',
      [
        { x: 0.1, y: 0.1 },
        { x: 0.2, y: 0.2 },
      ],
      0.05,
      1,
    );
    expect(msg.type).toBe('gm_erase_mask');
    expect(msg.stroke.points).toHaveLength(2);
    expect(msg.stroke.radius).toBe(0.05);
    expect(msg.stroke.softness).toBe(1);
  });

  it('eraseMaskStroke defaults softness to 1', () => {
    const msg = eraseMaskStroke('o1', [{ x: 0.1, y: 0.1 }], 0.05);
    expect(msg.stroke.softness).toBe(1);
  });
});
