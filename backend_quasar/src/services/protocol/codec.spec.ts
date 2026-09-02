import { describe, it, expect } from 'vitest';
import { encodeClientMessage, decodeServerMessage } from './codec';
import type { ClientMessage, ServerMessage } from './types';

describe('codec', () => {
  it('encodes a client message', () => {
    const msg: ClientMessage = {
      type: 'report_object_position',
      objectId: 'o1',
      position: { x: 0.5, y: 0.5 },
      mapName: 'Map001',
    };
    const encoded = encodeClientMessage(msg);
    expect(typeof encoded).toBe('string');
    expect(JSON.parse(encoded)).toEqual(msg);
  });

  it('decodes gm_update message', () => {
    const msg: ServerMessage = {
      type: 'gm_update',
      state: {
        currentMap: 'Map001',
        players: {},
        objects: {},
        spawnPoints: {},
      },
      clientConnected: true,
    };
    const encoded = JSON.stringify(msg);
    expect(decodeServerMessage(encoded)).toEqual(msg);
  });

  it('decodes gm_error message', () => {
    const msg: ServerMessage = { type: 'gm_error', reason: 'something went wrong' };
    const encoded = JSON.stringify(msg);
    expect(decodeServerMessage(encoded)).toEqual(msg);
  });

  it('returns null for malformed json', () => {
    expect(decodeServerMessage('not json')).toBeNull();
  });

  it('returns null for non-object json', () => {
    expect(decodeServerMessage('123')).toBeNull();
  });

  it('returns null for gm_update with invalid state', () => {
    expect(decodeServerMessage(JSON.stringify({ type: 'gm_update', state: {}, clientConnected: true }))).toBeNull();
  });

  it('returns null for unknown type', () => {
    expect(decodeServerMessage(JSON.stringify({ type: 'unknown' }))).toBeNull();
  });
});
