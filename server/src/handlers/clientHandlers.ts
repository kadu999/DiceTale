import { WebSocket } from 'ws';
import { ClientMessage } from '../types';
import { gameState } from '../GameState';
import { saveState } from '../persistence';
import * as commands from '../commands/clientCommands';

export class ClientHandler {
  constructor(
    private ws: WebSocket,
    private gmSockets: Set<WebSocket>,
    private broadcast: () => void
  ) {}

  handle(message: ClientMessage) {
    switch (message.type) {
      case 'request_join':
        commands.syncState(this.ws);
        break;
      case 'register_map_objects':
        gameState.setMap(message.mapName);
        gameState.registerDoors(message.mapName, message.doors);
        gameState.registerSpawnPoints(message.mapName, message.spawnPoints);
        saveState();
        this.broadcast();
        break;
      case 'request_door_access':
        this.handleDoorAccess(message.doorId);
        break;
      case 'request_teleport':
        gameState.setMap(message.mapName);
        commands.teleportPlayer(this.ws, message.mapName, message.spawnId);
        saveState();
        this.broadcast();
        break;
      case 'report_player_position':
        gameState.setPlayerPosition(message.position);
        this.broadcast();
        break;
      default:
        console.warn('[ClientHandler] Unknown message:', (message as any).type);
    }
  }

  private handleDoorAccess(doorId: string) {
    const door = gameState.doors[doorId];
    if (!door) {
      console.warn('[ClientHandler] Door not found:', doorId);
      return;
    }

    if (!door.unlocked) {
      gameState.setDoorUnlocked(doorId, true);
    }

    if (door.isPortal) {
      gameState.setMap(door.targetMap);
      commands.teleportPlayer(this.ws, door.targetMap, door.targetSpawn);
    } else {
      commands.setDoorState(this.ws, doorId, true);
    }

    saveState();
    this.broadcast();
  }
}
