import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useWsStore } from './wsStore';
import { useGameStateStore } from './gameStateStore';
import type { GameStateSnapshot } from 'src/services/protocol/types';

const fakeUrl = 'ws://localhost/ws/gm';
let activeSockets: MockWebSocket[] = [];

class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  url = fakeUrl;
  readyState = MockWebSocket.CONNECTING;
  onopen: ((this: WebSocket, ev: Event) => void) | null = null;
  onmessage: ((this: WebSocket, ev: MessageEvent) => void) | null = null;
  onclose: ((this: WebSocket, ev: CloseEvent) => void) | null = null;
  onerror: ((this: WebSocket, ev: Event) => void) | null = null;

  sent: string[] = [];
  closed = false;

  constructor(public readonly ctorUrl: string) {
    activeSockets.push(this);
    queueMicrotask(() => {
      this.readyState = MockWebSocket.OPEN;
      this.onopen?.call(this as unknown as WebSocket, new Event('open'));
    });
  }

  send(data: unknown): void {
    this.sent.push(String(data));
  }

  close(): void {
    this.closed = true;
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.call(this as unknown as WebSocket, { code: 1000 } as CloseEvent);
  }

  receive(data: string): void {
    this.onmessage?.call(this as unknown as WebSocket, new MessageEvent('message', { data }));
  }
}

function currentSocket(store: ReturnType<typeof useWsStore>): MockWebSocket {
  return store.socket as unknown as MockWebSocket;
}

describe('wsStore', () => {
  let WebSocketBackup: typeof WebSocket;

  beforeEach(() => {
    WebSocketBackup = globalThis.WebSocket;
    globalThis.WebSocket = MockWebSocket as unknown as typeof WebSocket;
    activeSockets = [];
    vi.useFakeTimers({ shouldAdvanceTime: true });
    setActivePinia(createPinia());
  });

  afterEach(() => {
    vi.useRealTimers();
    globalThis.WebSocket = WebSocketBackup;
    activeSockets = [];
  });

  it('send returns false when not connected', () => {
    const store = useWsStore();
    expect(store.send({ type: 'sync_state' })).toBe(false);
    expect(store.lastError).toContain('未连接服务器');
  });

  it('connects and exposes isConnected', async () => {
    const store = useWsStore();
    store.connect();
    await vi.advanceTimersByTimeAsync(0);
    expect(store.isConnected).toBe(true);
  });

  it('sends encoded messages when open', async () => {
    const store = useWsStore();
    store.connect();
    await vi.advanceTimersByTimeAsync(0);
    const ok = store.send({ type: 'sync_state' });
    expect(ok).toBe(true);
    expect(currentSocket(store).sent).toHaveLength(1);
  });

  it('dispatches gm_update to gameStateStore', async () => {
    const store = useWsStore();
    const gameState = useGameStateStore();
    store.connect();
    await vi.advanceTimersByTimeAsync(0);

    const snapshot: GameStateSnapshot = {
      currentMap: 'Map001',
      players: {},
      objects: { o1: { objectId: 'o1' } },
      spawnPoints: {},
    };
    currentSocket(store).receive(
      JSON.stringify({ type: 'gm_update', state: snapshot, clientConnected: true }),
    );

    expect(gameState.snapshot.currentMap).toBe('Map001');
    expect(gameState.clientConnected).toBe(true);
  });

  it('records gm_error message', async () => {
    const store = useWsStore();
    store.connect();
    await vi.advanceTimersByTimeAsync(0);
    currentSocket(store).receive(JSON.stringify({ type: 'gm_error', reason: 'boom' }));
    expect(store.lastError).toBe('boom');
  });

  it('schedules exponential reconnect on close', async () => {
    const store = useWsStore();
    store.connect();
    await vi.advanceTimersByTimeAsync(0);
    currentSocket(store).close();
    expect(store.isConnected).toBe(false);
    await vi.advanceTimersByTimeAsync(2500);
    expect(activeSockets).toHaveLength(2);
  });

  it('does not reconnect after explicit disconnect', async () => {
    const store = useWsStore();
    store.connect();
    await vi.advanceTimersByTimeAsync(0);
    expect(activeSockets).toHaveLength(1);

    store.disconnect();
    await vi.advanceTimersByTimeAsync(0);
    expect(activeSockets).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(35000);
    expect(activeSockets).toHaveLength(1);
  });

  it('does not create a second socket while CONNECTING', async () => {
    const store = useWsStore();
    store.connect();
    expect(activeSockets).toHaveLength(1);
    store.connect();
    expect(activeSockets).toHaveLength(1);
  });
});
