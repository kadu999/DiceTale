import { WebSocket } from 'ws';
import { GmMessage } from '../types';
import { gameState } from '../GameState';
import { saveState } from '../persistence';
import * as commands from '../commands/clientCommands';

export class GmHandler {
  constructor(
    private ws: WebSocket,
    private getClientSocket: () => WebSocket | null,
    private broadcast: () => void
  ) {}

  handle(message: GmMessage) {
    switch (message.type) {
      case 'gm_open_door':
        this.setDoor(message.doorId, true);
        break;
      case 'gm_close_door':
        this.setDoor(message.doorId, false);
        break;
      case 'gm_teleport_player':
        this.teleportPlayer(message.mapName, message.spawnId);
        break;
      case 'gm_refresh':
        commands.syncState(this.ws);
        break;
      default:
        console.warn('[GmHandler] Unknown message:', (message as any).type);
    }
  }

  private setDoor(doorId: string, unlocked: boolean) {
    if (!gameState.setDoorUnlocked(doorId, unlocked)) {
      console.warn('[GmHandler] Door not found:', doorId);
      return;
    }

    const clientSocket = this.getClientSocket();
    if (clientSocket) {
      commands.setDoorState(clientSocket, doorId, unlocked);
    }

    saveState();
    this.broadcast();
  }

  private teleportPlayer(mapName: string, spawnId: string) {
    gameState.setMap(mapName);
    const clientSocket = this.getClientSocket();
    if (clientSocket) {
      commands.teleportPlayer(clientSocket, mapName, spawnId);
    }
    saveState();
    this.broadcast();
  }
}
