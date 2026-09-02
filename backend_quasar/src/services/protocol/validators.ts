import type { ClientMessage, Position, PlayerInfo, ObjectInfo } from './types';

const RESERVED_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

export function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0 && !RESERVED_KEYS.has(v);
}

export function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

export function isPosition(v: unknown): v is Position {
  if (typeof v !== 'object' || v === null) return false;
  const p = v as Record<string, unknown>;
  return (
    isFiniteNumber(p.x) &&
    isFiniteNumber(p.y) &&
    p.x >= 0 &&
    p.x <= 1 &&
    p.y >= 0 &&
    p.y <= 1
  );
}

export function isPlayerInfo(v: unknown): v is PlayerInfo {
  if (typeof v !== 'object' || v === null) return false;
  const p = v as Record<string, unknown>;
  return isNonEmptyString(p.playerId);
}

export function isObjectInfo(v: unknown): v is ObjectInfo {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  return isNonEmptyString(o.objectId);
}

export function validateClientMessage(msg: unknown): ClientMessage | null {
  if (typeof msg !== 'object' || msg === null) return null;
  const m = msg as Record<string, unknown>;
  const type = m.type;
  if (typeof type !== 'string') return null;

  switch (type) {
    case 'register_players': {
      if (!Array.isArray(m.players) || !m.players.every(isPlayerInfo)) return null;
      return { type, players: m.players };
    }
    case 'register_map_objects': {
      if (!isNonEmptyString(m.mapName)) return null;
      if (!Array.isArray(m.objects) || !m.objects.every(isObjectInfo)) return null;
      const spawnPoints = m.spawnPoints;
      if (spawnPoints !== undefined) {
        if (typeof spawnPoints !== 'object' || spawnPoints === null) return null;
        for (const [key, value] of Object.entries(spawnPoints)) {
          if (!isNonEmptyString(key) || !Array.isArray(value) || !value.every((i) => typeof i === 'string')) {
            return null;
          }
        }
      }
      return { type, mapName: m.mapName, objects: m.objects, spawnPoints: spawnPoints as Record<string, string[]> | undefined };
    }
    case 'report_player_position': {
      if (!isNonEmptyString(m.playerId) || !isPosition(m.position) || typeof m.mapName !== 'string') return null;
      return { type, playerId: m.playerId, position: m.position, mapName: m.mapName };
    }
    case 'report_object_position': {
      if (!isNonEmptyString(m.objectId) || !isPosition(m.position) || typeof m.mapName !== 'string') return null;
      return { type, objectId: m.objectId, position: m.position, mapName: m.mapName };
    }
    case 'gm_set_int': {
      if (!isNonEmptyString(m.objectId) || !isFiniteNumber(m.value) || !Number.isInteger(m.value)) return null;
      return { type, objectId: m.objectId, value: m.value };
    }
    case 'gm_set_float': {
      if (!isNonEmptyString(m.objectId) || !isFiniteNumber(m.value)) return null;
      return { type, objectId: m.objectId, value: m.value };
    }
    case 'gm_set_bool': {
      if (!isNonEmptyString(m.objectId) || typeof m.value !== 'boolean') return null;
      return { type, objectId: m.objectId, value: m.value };
    }
    case 'gm_set_option': {
      if (!isNonEmptyString(m.objectId) || !isNonEmptyString(m.option)) return null;
      return { type, objectId: m.objectId, option: m.option };
    }
    case 'gm_set_object_items': {
      if (!isNonEmptyString(m.objectId) || !Array.isArray(m.items) || !m.items.every((i) => typeof i === 'string')) return null;
      return { type, objectId: m.objectId, items: m.items as string[] };
    }
    case 'gm_erase_mask': {
      if (!isNonEmptyString(m.objectId) || typeof m.stroke !== 'object' || m.stroke === null) return null;
      const s = m.stroke as Record<string, unknown>;
      if (!Array.isArray(s.points) || !s.points.every(isPosition) || !isFiniteNumber(s.radius) || !isFiniteNumber(s.softness)) {
        return null;
      }
      return { type, objectId: m.objectId, stroke: { points: s.points, radius: s.radius, softness: s.softness } };
    }
    case 'sync_state':
    case 'heartbeat': {
      if (Object.keys(m).length !== 1) return null;
      return { type };
    }
    default:
      return null;
  }
}
