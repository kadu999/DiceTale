import { WebSocket } from 'ws';
import {
  ServerMessage,
  GmServerMessage,
  GmUpdateMessage,
  GameStateSnapshot,
  EraseStroke,
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

export function setObjectOption(ws: WebSocket, objectId: string, option: string) {
  send(ws, { type: 'set_option', objectId, option });
}

export function setObjectItems(ws: WebSocket, objectId: string, items: string[]) {
  send(ws, { type: 'set_object_items', objectId, items });
}

/** 下发 GM 擦除后的遮罩图（base64 PNG）给客户端遮罩对象。 */
export function setMaskImage(ws: WebSocket, objectId: string, image: string) {
  send(ws, { type: 'set_mask_image', objectId, image });
}

/** 下发 GM 擦除遮罩的笔画轨迹给客户端（客户端 shader 计算软边）。 */
export function eraseMask(ws: WebSocket, objectId: string, stroke: EraseStroke) {
  send(ws, { type: 'erase_mask', objectId, stroke });
}

/** 下发 GM 设置的浮点参数（FloatValue 组件）。 */
export function setFloat(ws: WebSocket, objectId: string, value: number) {
  send(ws, { type: 'set_float', objectId, value });
}

/** 下发 GM 设置的整数参数（IntValue 组件）。 */
export function setInt(ws: WebSocket, objectId: string, value: number) {
  send(ws, { type: 'set_int', objectId, value });
}

/** 下发 GM 设置的布尔参数（BoolValue 组件）。 */
export function setBool(ws: WebSocket, objectId: string, value: boolean) {
  send(ws, { type: 'set_bool', objectId, value });
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
