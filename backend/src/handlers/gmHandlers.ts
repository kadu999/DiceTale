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

  /** 设置对象物品列表：立即更新本地快照并广播（不等待客户端回执），再转发给客户端保持一致；超过道具库存时拒绝。 */
  private setObjectItems(objectId: string, items: string[]) {
    if (this.wouldExceedStock(objectId, items)) {
      console.warn(`[GmHandler] reject set_object_items ${objectId}: would exceed item stock`);
      this.broadcast(); // 回滚到当前状态，页面保持一致
      return;
    }

    if (gameState.setObjectItems(objectId, items)) {
      this.broadcast();
    }

    const clientSocket = this.getClientSocket();
    if (clientSocket) {
      commands.setObjectItems(clientSocket, objectId, items);
    }
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

  /** 按新物品列表计算：是否会导致某道具名的玩家持有总数超过总库存（除该玩家外其他玩家持有 + 新列表）。 */
  private wouldExceedStock(objectId: string, newItems: string[]): boolean {
    const stock = this.itemStock();
    if (Object.keys(stock).length === 0) return false;

    const counts: Record<string, number> = {};
    for (const [pid, obj] of Object.entries(gameState.objects)) {
      if (pid === objectId) continue;
      for (const it of obj.items ?? []) counts[it] = (counts[it] || 0) + 1;
    }
    for (const it of newItems) counts[it] = (counts[it] || 0) + 1;

    for (const name of Object.keys(stock)) {
      if ((counts[name] || 0) > stock[name]) return true;
    }
    return false;
  }
}
