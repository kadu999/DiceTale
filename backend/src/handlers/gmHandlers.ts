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
      case 'gm_set_object_items':
        this.setObjectItems(message.objectId, message.items);
        break;
      default:
        console.warn('[GmHandler] Unknown message:', (message as any).type);
    }
  }

  /** 给 GM 页面回操作失败提示（客户端未连接、超出库存等）。 */
  private sendError(reason: string) {
    commands.sendGmError(this.ws, reason);
  }

  private teleportPlayer(mapName: string, spawnId: string) {
    const clientSocket = this.getClientSocket();
    if (!clientSocket) {
      this.sendError('客户端未连接，无法传送');
      return;
    }
    gameState.setMap(mapName);
    commands.teleportPlayer(clientSocket, mapName, spawnId);
    this.broadcast();
  }

  /** 切换客户端对象状态：乐观更新快照并广播（与 setObjectItems 一致），再转发命令；客户端回执 report_object_state 会再次校正。 */
  private setObjectState(objectId: string, state: string) {
    const clientSocket = this.getClientSocket();
    if (!clientSocket) {
      this.sendError('客户端未连接，无法切换状态');
      return;
    }
    if (gameState.setObjectState(objectId, state)) {
      this.broadcast();
    }
    commands.setObjectState(clientSocket, objectId, state);
  }

  /** 设置对象物品列表：立即更新本地快照并广播（不等待客户端回执），再转发给客户端保持一致；超过道具库存时拒绝。 */
  private setObjectItems(objectId: string, items: string[]) {
    const clientSocket = this.getClientSocket();
    if (!clientSocket) {
      this.sendError('客户端未连接，无法设置物品');
      return;
    }

    if (this.wouldExceedStock(objectId, items)) {
      console.warn(`[GmHandler] reject set_object_items ${objectId}: would exceed item stock`);
      this.broadcast(); // 回滚到当前状态，页面保持一致
      this.sendError('超出道具库存上限，已拒绝');
      return;
    }

    if (gameState.setObjectItems(objectId, items)) {
      this.broadcast();
    }

    commands.setObjectItems(clientSocket, objectId, items);
  }

  /** 道具名 -> 总库存（多个同名道具对象的 quantity 累加）。 */
  private itemStock(): Record<string, number> {
    const stock: Record<string, number> = {};
    for (const obj of Object.values(gameState.objects)) {
      if (obj.itemName && obj.quantity) {
        stock[obj.itemName] = (stock[obj.itemName] || 0) + obj.quantity;
      }
    }
    return stock;
  }

  /** 按新物品列表计算：是否会导致某道具名的玩家持有总数超过总库存。只统计已注册玩家持有，与 GM 页面口径一致。 */
  private wouldExceedStock(objectId: string, newItems: string[]): boolean {
    const stock = this.itemStock();
    if (Object.keys(stock).length === 0) return false;

    const counts: Record<string, number> = {};
    for (const pid of Object.keys(gameState.players)) {
      if (pid === objectId) continue;
      const obj = gameState.objects[pid];
      for (const it of obj?.items ?? []) counts[it] = (counts[it] || 0) + 1;
    }
    for (const it of newItems) counts[it] = (counts[it] || 0) + 1;

    for (const name of Object.keys(stock)) {
      if ((counts[name] || 0) > stock[name]) return true;
    }
    return false;
  }
}
