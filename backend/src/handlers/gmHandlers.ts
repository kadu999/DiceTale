import { WebSocket } from 'ws';
import { GmMessage, EraseStroke } from '../types';
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
      case 'gm_set_mask_image':
        this.setMaskImage(message.objectId, message.image);
        break;
      case 'gm_erase_mask':
        this.eraseMask(message.objectId, message.stroke);
        break;
      case 'gm_set_float':
        this.setFloat(message.objectId, message.value);
        break;
      case 'gm_set_int':
        this.setInt(message.objectId, message.value);
        break;
      case 'gm_set_bool':
        this.setBool(message.objectId, message.value);
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

  /** 切换客户端对象状态：乐观更新快照并广播，再转发命令（客户端不回执，后台快照为准）。 */
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

  /** 转发 GM 擦除后的遮罩图给客户端（遮罩对象），客户端替换本地纹理。 */
  private setMaskImage(objectId: string, image: string) {
    const clientSocket = this.getClientSocket();
    if (!clientSocket) {
      this.sendError('客户端未连接，无法更新遮罩');
      return;
    }
    commands.setMaskImage(clientSocket, objectId, image);
  }

  /** 转发 GM 擦除遮罩的笔画轨迹给客户端（软边由客户端 shader 计算）。 */
  private eraseMask(objectId: string, stroke: EraseStroke) {
    const clientSocket = this.getClientSocket();
    if (!clientSocket) {
      this.sendError('客户端未连接，无法擦除遮罩');
      return;
    }
    commands.eraseMask(clientSocket, objectId, stroke);
  }

  /** 设置对象浮点参数：乐观更新快照并广播，再转发命令（客户端不回执）。 */
  private setFloat(objectId: string, value: number) {
    const clientSocket = this.getClientSocket();
    if (!clientSocket) {
      this.sendError('客户端未连接，无法设置参数');
      return;
    }
    if (gameState.setObjectFloat(objectId, value)) {
      this.broadcast();
    }
    commands.setFloat(clientSocket, objectId, value);
  }

  /** 设置对象整数参数：乐观更新快照并广播，再转发命令（客户端不回执）。 */
  private setInt(objectId: string, value: number) {
    const clientSocket = this.getClientSocket();
    if (!clientSocket) {
      this.sendError('客户端未连接，无法设置参数');
      return;
    }
    if (gameState.setObjectInt(objectId, value)) {
      this.broadcast();
    }
    commands.setInt(clientSocket, objectId, value);
  }

  /** 设置对象布尔参数：乐观更新快照并广播，再转发命令（客户端不回执）。 */
  private setBool(objectId: string, value: boolean) {
    const clientSocket = this.getClientSocket();
    if (!clientSocket) {
      this.sendError('客户端未连接，无法设置参数');
      return;
    }
    if (gameState.setObjectBool(objectId, value)) {
      this.broadcast();
    }
    commands.setBool(clientSocket, objectId, value);
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
