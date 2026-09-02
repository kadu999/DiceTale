import { WebSocket } from 'ws';
import { ClientMessage } from '../types';
import { gameState } from '../GameState';
import * as commands from '../commands/clientCommands';
import { isNonEmptyString, isPosition } from './validate';

export class ClientHandler {
  constructor(private ws: WebSocket, private broadcast: () => void) {}

  handle(message: ClientMessage) {
    switch (message.type) {
      case 'request_join':
        commands.syncState(this.ws);
        break;
      case 'register_map_objects': {
        if (!isNonEmptyString(message.mapName)) return this.reject('register_map_objects');
        gameState.setMap(message.mapName);
        if (Array.isArray(message.spawnPoints)) {
          gameState.registerSpawnPoints(
            message.mapName,
            message.spawnPoints.filter((sp) => sp && isNonEmptyString(sp.id))
          );
        }
        // objects 缺省时跳过 registerObjects：它是整体替换语义，畸形/旧版客户端漏传会把已注册对象全部清空
        if (message.objects !== undefined) {
          if (!Array.isArray(message.objects)) return this.reject('register_map_objects');
          gameState.registerObjects(
            message.mapName,
            message.objects.filter((o) => o && isNonEmptyString(o.id))
          );
        }
        this.broadcast();
        break;
      }
      case 'register_players': {
        if (!Array.isArray(message.players)) return this.reject('register_players');
        gameState.registerPlayers(message.players.filter((p) => p && isNonEmptyString(p.id)));
        this.broadcast();
        break;
      }
      case 'request_teleport': {
        if (!isNonEmptyString(message.mapName) || typeof message.spawnId !== 'string') {
          return this.reject('request_teleport');
        }
        gameState.setMap(message.mapName);
        commands.teleportPlayer(this.ws, message.mapName, message.spawnId);
        this.broadcast();
        break;
      }
      case 'report_player_position': {
        if (
          !isNonEmptyString(message.playerId) ||
          !isPosition(message.position) ||
          !isNonEmptyString(message.mapName)
        ) {
          return this.reject('report_player_position');
        }
        // 未知玩家的上报只打日志不自动注册：/client 无认证，不能借此灌入假玩家
        if (!gameState.setPlayerPosition(message.playerId, message.position, message.mapName)) {
          console.warn('[ClientHandler] position report from unknown player:', message.playerId);
          break;
        }
        this.broadcast();
        break;
      }
      case 'report_object_position': {
        if (
          !isNonEmptyString(message.objectId) ||
          !isPosition(message.position) ||
          !isNonEmptyString(message.mapName)
        ) {
          return this.reject('report_object_position');
        }
        if (gameState.updateObjectPosition(message.objectId, message.position, message.mapName)) {
          this.broadcast();
        }
        break;
      }
      case 'heartbeat':
        // 应用层心跳：仅用于存活检测（index.ts 的 lastSeen），无状态变更
        break;
      default:
        console.warn('[ClientHandler] Unknown message:', (message as any).type);
    }
  }

  /** 畸形消息：打日志后丢弃，不进状态。 */
  private reject(kind: string) {
    console.warn(`[ClientHandler] invalid ${kind} message, dropped`);
  }
}
