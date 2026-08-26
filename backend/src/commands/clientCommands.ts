import { WebSocket } from 'ws';
import { ServerMessage, GmUpdateMessage, GameStateSnapshot } from '../types';
import { gameState } from '../GameState';

export function send(ws: WebSocket, message: ServerMessage) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
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

export function broadcastGmUpdate(gmSockets: Set<WebSocket>, state?: GameStateSnapshot) {
  const snapshot = state ?? gameState.getSnapshot();
  const message: GmUpdateMessage = { type: 'gm_update', state: snapshot };
  const text = JSON.stringify(message);
  for (const ws of gmSockets) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(text);
    }
  }
}
