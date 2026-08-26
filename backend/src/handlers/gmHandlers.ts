import { WebSocket } from 'ws';
import { GmMessage } from '../types';
import { gameState } from '../GameState';
import * as commands from '../commands/clientCommands';

export class GmHandler {
  constructor(
    private ws: WebSocket,
    private getClientSocket: () => WebSocket | null,
    private broadcast: () => void
  ) {}

  handle(message: GmMessage) {
    switch (message.type) {
      case 'gm_teleport_player':
        this.teleportPlayer(message.mapName, message.spawnId);
        break;
      case 'gm_set_object_state':
        this.setObjectState(message.objectId, message.state);
        break;
      case 'gm_refresh':
        commands.syncState(this.ws);
        break;
      default:
        console.warn('[GmHandler] Unknown message:', (message as any).type);
    }
  }

  private teleportPlayer(mapName: string, spawnId: string) {
    gameState.setMap(mapName);
    const clientSocket = this.getClientSocket();
    if (clientSocket) {
      commands.teleportPlayer(clientSocket, mapName, spawnId);
    }
    this.broadcast();
  }

  /** 切换客户端对象状态：对象本体在客户端，仅转发命令，无需后台持久化。 */
  private setObjectState(objectId: string, state: string) {
    const clientSocket = this.getClientSocket();
    if (clientSocket) {
      commands.setObjectState(clientSocket, objectId, state);
    }
  }
}
