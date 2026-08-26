import { WebSocket } from 'ws';
import { ClientHandler } from './handlers/clientHandlers';
import { ClientMessage } from './types';

export class ClientSession {
  private handler: ClientHandler;

  constructor(
    private ws: WebSocket,
    gmSockets: Set<WebSocket>,
    broadcast: () => void
  ) {
    this.handler = new ClientHandler(ws, gmSockets, broadcast);

    ws.on('message', (raw) => {
      try {
        const data = JSON.parse(raw.toString()) as ClientMessage;
        this.handler.handle(data);
      } catch (err) {
        console.error('[ClientSession] Invalid message:', err);
      }
    });

    ws.on('close', () => {
      console.log('[ClientSession] Client disconnected');
    });
  }
}
