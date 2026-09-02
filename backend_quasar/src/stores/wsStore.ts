import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { ClientMessage } from 'src/services/protocol/types';
import { encodeClientMessage, decodeServerMessage } from 'src/services/protocol/codec';
import { useGameStateStore } from './gameStateStore';

const WS_BASE = import.meta.env.DEV
  ? 'ws://localhost:1420'
  : `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}`;
const INITIAL_RECONNECT_DELAY = 2000;
const MAX_RECONNECT_DELAY = 30000;

export const useWsStore = defineStore('ws', () => {
  const socket = ref<WebSocket | null>(null);
  const isConnected = ref(false);
  const lastError = ref<string | null>(null);
  let reconnectDelay = INITIAL_RECONNECT_DELAY;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let shouldReconnect = true;

  const gameState = useGameStateStore();

  function scheduleReconnect(): void {
    if (reconnectTimer) return;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, reconnectDelay);
    reconnectDelay = Math.min(MAX_RECONNECT_DELAY, reconnectDelay * 2 + Math.random() * 1000);
  }

  function connect(): void {
    shouldReconnect = true;
    const readyState = socket.value?.readyState;
    if (readyState === WebSocket.OPEN || readyState === WebSocket.CONNECTING) return;
    const ws = new WebSocket(`${WS_BASE}/gm`);

    ws.onopen = () => {
      isConnected.value = true;
      lastError.value = null;
      reconnectDelay = INITIAL_RECONNECT_DELAY;
    };

    ws.onmessage = (event: MessageEvent) => {
      const msg = decodeServerMessage(String(event.data));
      if (!msg) return;
      if (msg.type === 'gm_update') {
        gameState.applySnapshot(msg.state);
        gameState.setClientConnected(msg.clientConnected);
      } else if (msg.type === 'gm_error') {
        lastError.value = msg.reason;
      }
    };

    ws.onclose = () => {
      isConnected.value = false;
      socket.value = null;
      if (shouldReconnect) scheduleReconnect();
    };

    ws.onerror = () => {
      lastError.value = 'WebSocket 连接出错';
    };

    socket.value = ws;
  }

  function send(msg: ClientMessage): boolean {
    if (socket.value?.readyState !== WebSocket.OPEN) {
      lastError.value = '未连接服务器，操作未发送';
      return false;
    }
    socket.value.send(encodeClientMessage(msg));
    return true;
  }

  function disconnect(): void {
    shouldReconnect = false;
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    socket.value?.close();
  }

  return {
    socket: computed(() => socket.value),
    isConnected: computed(() => isConnected.value),
    lastError: computed(() => lastError.value),
    connect,
    send,
    disconnect,
  };
});
