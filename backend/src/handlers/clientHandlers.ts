import { WebSocket } from 'ws';
import { ClientMessage } from '../types';
import { gameState } from '../GameState';
import * as commands from '../commands/clientCommands';

export class ClientHandler {
  constructor(private ws: WebSocket, private broadcast: () => void) {}

  handle(message: ClientMessage) {
    switch (message.type) {
      case 'request_join':
        commands.syncState(this.ws);
        break;
      case 'register_map_objects':
        gameState.setMap(message.mapName);
        gameState.registerSpawnPoints(message.mapName, message.spawnPoints);
        gameState.registerObjects(message.mapName, message.objects ?? []);
        this.broadcast();
        break;
      case 'register_players':
        gameState.registerPlayers(message.players);
        this.broadcast();
        break;
      case 'request_teleport':
        gameState.setMap(message.mapName);
        commands.teleportPlayer(this.ws, message.mapName, message.spawnId);
        this.broadcast();
        break;
      case 'report_player_position':
        gameState.setPlayerPosition(message.playerId, message.position, message.mapName);
        this.broadcast();
        break;
      case 'report_object_state':
        if (gameState.setObjectState(message.objectId, message.state)) {
          this.broadcast();
        }
        break;
      case 'report_object_items':
        if (gameState.setObjectItems(message.objectId, message.items)) {
          this.broadcast();
        }
        break;
      case 'heartbeat':
        // 应用层心跳：仅用于存活检测（index.ts 的 lastSeen），无状态变更
        break;
      default:
        console.warn('[ClientHandler] Unknown message:', (message as any).type);
    }
  }
}
