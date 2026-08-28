import { WebSocket } from 'ws';
import {
  ServerMessage,
  GmServerMessage,
  GmUpdateMessage,
  GameStateSnapshot,
} from '../types';
import { gameState } from '../GameState';

/** 发送消息；readyState 检查后 send 仍可能因竞态抛错（连接恰在检查后关闭），统一捕获。 */
export function send(ws: WebSocket, message: ServerMessage | GmServerMessage) {
  if (ws.readyState !== WebSocket.OPEN) return;
  try {
    ws.send(JSON.stringify(message));
  } catch (err) {
    console.error('[Server] send failed:', (err as Error).message);
  }
}

/** 给 GM 控制台回操作失败提示（客户端未连接、超出库存等）。 */
export function sendGmError(ws: WebSocket, reason: string) {
  send(ws, { type: 'gm_error', reason });
}

export function syncState(ws: WebSocket) {
  send(ws, { type: 'sync_state', state: gameState.getSnapshot() });
}

export function teleportPlayer(ws: WebSocket, mapName: string, spawnId: string) {
  send(ws, { type: 'teleport_player', mapName, spawnId });
}

export function setObjectState(ws: WebSocket, objectId: string, state: string) {
  send(ws, { type: 'set_object_state', objectId, state });
}

export function setObjectItems(ws: WebSocket, objectId: string, items: string[]) {
  send(ws, { type: 'set_object_items', objectId, items });
}

/** 下发 GM 擦除后的遮罩图（base64 PNG）给客户端遮罩对象。 */
export function setMaskImage(ws: WebSocket, objectId: string, image: string) {
  send(ws, { type: 'set_mask_image', objectId, image });
}

/** 向所有 GM 控制台广播最新快照（含客户端在线状态）。 */
export function broadcastGmUpdate(
  gmSockets: Set<WebSocket>,
  state?: GameStateSnapshot,
  clientConnected = false
) {
  const snapshot = state ?? gameState.getSnapshot();
  const message: GmUpdateMessage = { type: 'gm_update', state: snapshot, clientConnected };
  const text = JSON.stringify(message);
  for (const ws of gmSockets) {
    if (ws.readyState !== WebSocket.OPEN) continue;
    try {
      ws.send(text);
    } catch (err) {
      console.error('[Server] gm_update send failed:', (err as Error).message);
    }
  }
}
