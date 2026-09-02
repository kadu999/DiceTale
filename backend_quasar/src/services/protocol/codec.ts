import type { ClientMessage, ServerMessage, GameStateSnapshot } from './types';

export function encodeClientMessage(msg: ClientMessage): string {
  return JSON.stringify(msg);
}

function isGameStateSnapshot(value: unknown): value is GameStateSnapshot {
  if (typeof value !== 'object' || value === null) return false;
  const s = value as Record<string, unknown>;
  return (
    typeof s.currentMap === 'string' &&
    typeof s.players === 'object' &&
    s.players !== null &&
    typeof s.objects === 'object' &&
    s.objects !== null &&
    typeof s.spawnPoints === 'object' &&
    s.spawnPoints !== null
  );
}

export function decodeServerMessage(data: string): ServerMessage | null {
  try {
    const parsed = JSON.parse(data) as unknown;
    if (typeof parsed !== 'object' || parsed === null) return null;
    const m = parsed as Record<string, unknown>;
    if (m.type === 'gm_update') {
      if (!isGameStateSnapshot(m.state) || typeof m.clientConnected !== 'boolean') return null;
      return { type: 'gm_update', state: m.state, clientConnected: m.clientConnected };
    }
    if (m.type === 'gm_error' && typeof m.reason === 'string') {
      return { type: 'gm_error', reason: m.reason };
    }
    return null;
  } catch {
    return null;
  }
}
