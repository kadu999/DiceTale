import { WebSocket } from 'ws';
import { GmHandler } from './handlers/gmHandlers';
import { GmMessage } from './types';

export class GmSession {
  private handler: GmHandler;

  constructor(
    ws: WebSocket,
    getClientSocket: () => WebSocket | null,
    broadcast: () => void
  ) {
    this.handler = new GmHandler(ws, getClientSocket, broadcast);

    ws.on('message', (raw) => {
      try {
        const data = JSON.parse(raw.toString()) as GmMessage;
        this.handler.handle(data);
      } catch (err) {
        console.error('[GmSession] Invalid message:', err);
      }
    });
  }
}
