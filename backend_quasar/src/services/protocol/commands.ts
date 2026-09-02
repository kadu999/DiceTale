import type { ClientMessage, Position } from './types';

export function setObjectOption(objectId: string, option: string): ClientMessage {
  return { type: 'gm_set_option', objectId, option };
}

export function setObjectInt(
  objectId: string,
  value: number,
  min?: number,
  max?: number,
): ClientMessage {
  let v = Math.round(value);
  if (min !== undefined) v = Math.max(min, v);
  if (max !== undefined) v = Math.min(max, v);
  return { type: 'gm_set_int', objectId, value: v };
}

export function setObjectFloat(
  objectId: string,
  value: number,
  min?: number,
  max?: number,
): ClientMessage {
  let v = value;
  if (min !== undefined) v = Math.max(min, v);
  if (max !== undefined) v = Math.min(max, v);
  return { type: 'gm_set_float', objectId, value: v };
}

export function setObjectBool(objectId: string, value: boolean): ClientMessage {
  return { type: 'gm_set_bool', objectId, value };
}

export function setObjectItems(objectId: string, items: string[]): ClientMessage {
  return { type: 'gm_set_object_items', objectId, items };
}

export function eraseMaskStroke(
  objectId: string,
  points: Position[],
  radius: number,
  softness = 1,
): ClientMessage {
  return { type: 'gm_erase_mask', objectId, stroke: { points, radius, softness } };
}
