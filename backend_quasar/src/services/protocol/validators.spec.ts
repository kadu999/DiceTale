import { describe, it, expect } from 'vitest';
import {
  isNonEmptyString,
  isFiniteNumber,
  isPosition,
  isPlayerInfo,
  isObjectInfo,
  validateClientMessage,
} from './validators';

describe('isNonEmptyString', () => {
  it('accepts normal strings', () => {
    expect(isNonEmptyString('hello')).toBe(true);
  });

  it('rejects empty strings', () => {
    expect(isNonEmptyString('')).toBe(false);
  });

  it('rejects non-strings', () => {
    expect(isNonEmptyString(123)).toBe(false);
    expect(isNonEmptyString(null)).toBe(false);
    expect(isNonEmptyString(undefined)).toBe(false);
  });

  it('rejects reserved prototype keys', () => {
    expect(isNonEmptyString('__proto__')).toBe(false);
    expect(isNonEmptyString('constructor')).toBe(false);
    expect(isNonEmptyString('prototype')).toBe(false);
  });
});

describe('isFiniteNumber', () => {
  it('accepts finite numbers', () => {
    expect(isFiniteNumber(0)).toBe(true);
    expect(isFiniteNumber(-1.5)).toBe(true);
  });

  it('rejects NaN and Infinity', () => {
    expect(isFiniteNumber(NaN)).toBe(false);
    expect(isFiniteNumber(Infinity)).toBe(false);
    expect(isFiniteNumber(-Infinity)).toBe(false);
  });

  it('rejects non-numbers', () => {
    expect(isFiniteNumber('1')).toBe(false);
    expect(isFiniteNumber(null)).toBe(false);
  });
});

describe('isPosition', () => {
  it('accepts positions in [0,1]', () => {
    expect(isPosition({ x: 0, y: 0 })).toBe(true);
    expect(isPosition({ x: 1, y: 1 })).toBe(true);
    expect(isPosition({ x: 0.5, y: 0.5 })).toBe(true);
  });

  it('rejects positions out of bounds', () => {
    expect(isPosition({ x: 1.5, y: 0.5 })).toBe(false);
    expect(isPosition({ x: 0.5, y: -0.1 })).toBe(false);
  });

  it('rejects missing coordinates', () => {
    expect(isPosition({ x: 0.5 })).toBe(false);
    expect(isPosition({ y: 0.5 })).toBe(false);
  });
});

describe('isPlayerInfo', () => {
  it('requires playerId', () => {
    expect(isPlayerInfo({ playerId: 'p1' })).toBe(true);
    expect(isPlayerInfo({})).toBe(false);
    expect(isPlayerInfo({ playerId: '' })).toBe(false);
  });
});

describe('isObjectInfo', () => {
  it('requires objectId', () => {
    expect(isObjectInfo({ objectId: 'o1' })).toBe(true);
    expect(isObjectInfo({})).toBe(false);
    expect(isObjectInfo({ objectId: '__proto__' })).toBe(false);
  });
});

describe('validateClientMessage', () => {
  it('rejects non-objects', () => {
    expect(validateClientMessage(null)).toBeNull();
    expect(validateClientMessage('string')).toBeNull();
    expect(validateClientMessage(123)).toBeNull();
  });

  it('rejects unknown type', () => {
    expect(validateClientMessage({ type: 'unknown' })).toBeNull();
  });

  it('rejects __proto__ keys', () => {
    const result = validateClientMessage({
      type: 'report_object_position',
      objectId: '__proto__',
      position: { x: 0.5, y: 0.5 },
      mapName: 'Map001',
    });
    expect(result).toBeNull();
  });

  it('rejects position out of [0,1]', () => {
    const result = validateClientMessage({
      type: 'report_player_position',
      playerId: 'p1',
      position: { x: 1.5, y: -0.1 },
      mapName: 'Map001',
    });
    expect(result).toBeNull();
  });

  it('accepts valid register_map_objects', () => {
    const result = validateClientMessage({ type: 'register_map_objects', mapName: 'Map001', objects: [] });
    expect(result).toEqual({ type: 'register_map_objects', mapName: 'Map001', objects: [] });
  });

  it('accepts register_map_objects with spawnPoints', () => {
    const result = validateClientMessage({
      type: 'register_map_objects',
      mapName: 'Map001',
      objects: [],
      spawnPoints: { Default: ['o1'] },
    });
    expect(result).toEqual({
      type: 'register_map_objects',
      mapName: 'Map001',
      objects: [],
      spawnPoints: { Default: ['o1'] },
    });
  });

  it('rejects register_map_objects with empty mapName', () => {
    expect(validateClientMessage({ type: 'register_map_objects', mapName: '', objects: [] })).toBeNull();
  });

  it('rejects register_map_objects with invalid spawnPoints', () => {
    expect(
      validateClientMessage({
        type: 'register_map_objects',
        mapName: 'Map001',
        objects: [],
        spawnPoints: { Default: [123] },
      }),
    ).toBeNull();
  });

  it('accepts register_players', () => {
    const result = validateClientMessage({ type: 'register_players', players: [{ playerId: 'p1' }] });
    expect(result).toEqual({ type: 'register_players', players: [{ playerId: 'p1' }] });
  });

  it('rejects register_players with missing playerId', () => {
    expect(validateClientMessage({ type: 'register_players', players: [{}] })).toBeNull();
  });

  it('accepts report_player_position', () => {
    const result = validateClientMessage({
      type: 'report_player_position',
      playerId: 'p1',
      position: { x: 0.5, y: 0.5 },
      mapName: 'Map001',
    });
    expect(result).toEqual({
      type: 'report_player_position',
      playerId: 'p1',
      position: { x: 0.5, y: 0.5 },
      mapName: 'Map001',
    });
  });

  it('accepts report_object_position', () => {
    const result = validateClientMessage({
      type: 'report_object_position',
      objectId: 'o1',
      position: { x: 0.5, y: 0.5 },
      mapName: 'Map001',
    });
    expect(result).toEqual({
      type: 'report_object_position',
      objectId: 'o1',
      position: { x: 0.5, y: 0.5 },
      mapName: 'Map001',
    });
  });

  it('accepts gm_set_int', () => {
    const result = validateClientMessage({
      type: 'gm_set_int',
      objectId: 'o1',
      value: 10,
    });
    expect(result).toEqual({
      type: 'gm_set_int',
      objectId: 'o1',
      value: 10,
    });
  });

  it('rejects gm_set_int with NaN', () => {
    expect(
      validateClientMessage({ type: 'gm_set_int', objectId: 'o1', value: NaN }),
    ).toBeNull();
  });

  it('rejects gm_set_int with non-integer', () => {
    expect(
      validateClientMessage({ type: 'gm_set_int', objectId: 'o1', value: 1.5 }),
    ).toBeNull();
  });

  it('accepts gm_set_float', () => {
    const result = validateClientMessage({
      type: 'gm_set_float',
      objectId: 'o1',
      value: 1.5,
    });
    expect(result).toEqual({
      type: 'gm_set_float',
      objectId: 'o1',
      value: 1.5,
    });
  });

  it('accepts gm_set_bool', () => {
    const result = validateClientMessage({
      type: 'gm_set_bool',
      objectId: 'o1',
      value: true,
    });
    expect(result).toEqual({
      type: 'gm_set_bool',
      objectId: 'o1',
      value: true,
    });
  });

  it('accepts gm_set_option', () => {
    const result = validateClientMessage({
      type: 'gm_set_option',
      objectId: 'o1',
      option: 'on',
    });
    expect(result).toEqual({
      type: 'gm_set_option',
      objectId: 'o1',
      option: 'on',
    });
  });

  it('rejects gm_set_option with empty option', () => {
    expect(
      validateClientMessage({ type: 'gm_set_option', objectId: 'o1', option: '' }),
    ).toBeNull();
  });

  it('accepts gm_set_object_items', () => {
    const result = validateClientMessage({
      type: 'gm_set_object_items',
      objectId: 'o1',
      items: ['sword', 'shield'],
    });
    expect(result).toEqual({
      type: 'gm_set_object_items',
      objectId: 'o1',
      items: ['sword', 'shield'],
    });
  });

  it('rejects gm_set_object_items with non-string items', () => {
    expect(
      validateClientMessage({ type: 'gm_set_object_items', objectId: 'o1', items: [123] }),
    ).toBeNull();
  });

  it('accepts gm_erase_mask', () => {
    const result = validateClientMessage({
      type: 'gm_erase_mask',
      objectId: 'o1',
      stroke: {
        points: [{ x: 0.1, y: 0.1 }, { x: 0.2, y: 0.2 }],
        radius: 0.05,
        softness: 1,
      },
    });
    expect(result).toEqual({
      type: 'gm_erase_mask',
      objectId: 'o1',
      stroke: {
        points: [{ x: 0.1, y: 0.1 }, { x: 0.2, y: 0.2 }],
        radius: 0.05,
        softness: 1,
      },
    });
  });

  it('rejects gm_erase_mask with out-of-bounds point', () => {
    expect(
      validateClientMessage({
        type: 'gm_erase_mask',
        objectId: 'o1',
        stroke: {
          points: [{ x: 0.1, y: 1.5 }],
          radius: 0.05,
          softness: 1,
        },
      }),
    ).toBeNull();
  });

  it('accepts sync_state', () => {
    const result = validateClientMessage({ type: 'sync_state' });
    expect(result).toEqual({ type: 'sync_state' });
  });

  it('rejects sync_state with extra fields', () => {
    expect(validateClientMessage({ type: 'sync_state', extra: true })).toBeNull();
  });

  it('accepts heartbeat', () => {
    const result = validateClientMessage({ type: 'heartbeat' });
    expect(result).toEqual({ type: 'heartbeat' });
  });
});
