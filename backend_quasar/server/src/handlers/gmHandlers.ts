import { WebSocket } from 'ws';
import { GmMessage, EraseStroke } from '../types';
import { gameState } from '../GameState';
import * as commands from '../commands/clientCommands';
import { isEraseStroke, isFiniteNumber, isNonEmptyString, isStringArray } from './validate';

export class GmHandler {
  constructor(
    private ws: WebSocket,
    private getClientSocket: () => WebSocket | null,
    private broadcast: () => void
  ) {}

  handle(message: GmMessage) {
    switch (message.type) {
      case 'gm_teleport_player':
        if (!isNonEmptyString(message.mapName) || typeof message.spawnId !== 'string') {
          return this.reject('gm_teleport_player');
        }
        this.teleportPlayer(message.mapName, message.spawnId);
        break;
      case 'gm_set_option':
        if (!isNonEmptyString(message.objectId) || typeof message.option !== 'string') {
          return this.reject('gm_set_option');
        }
        this.setObjectOption(message.objectId, message.option);
        break;
      case 'gm_set_object_items':
        if (!isNonEmptyString(message.objectId) || !isStringArray(message.items)) {
          return this.reject('gm_set_object_items');
        }
        this.setObjectItems(message.objectId, message.items);
        break;
      case 'gm_set_mask_image':
        if (!isNonEmptyString(message.objectId) || typeof message.image !== 'string') {
          return this.reject('gm_set_mask_image');
        }
        this.setMaskImage(message.objectId, message.image);
        break;
      case 'gm_erase_mask':
        if (!isNonEmptyString(message.objectId) || !isEraseStroke(message.stroke)) {
          return this.reject('gm_erase_mask');
        }
        this.eraseMask(message.objectId, message.stroke);
        break;
      case 'gm_set_float':
        // NaN/Infinity 经 JSON.stringify 会变 null，两端口径不一致，直接拒绝
        if (!isNonEmptyString(message.objectId) || !isFiniteNumber(message.value)) {
          return this.reject('gm_set_float');
        }
        this.setFloat(message.objectId, message.value);
        break;
      case 'gm_set_int':
        if (!isNonEmptyString(message.objectId) || !Number.isInteger(message.value)) {
          return this.reject('gm_set_int');
        }
        this.setInt(message.objectId, message.value);
        break;
      case 'gm_set_bool':
        if (!isNonEmptyString(message.objectId) || typeof message.value !== 'boolean') {
          return this.reject('gm_set_bool');
        }
        this.setBool(message.objectId, message.value);
        break;
      default:
        console.warn('[GmHandler] Unknown message:', (message as any).type);
    }
  }

  /** 畸形消息：打日志后丢弃，不进状态也不转发。 */
  private reject(kind: string) {
    console.warn(`[GmHandler] invalid ${kind} message, dropped`);
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

  /** 设置客户端对象当前选项：乐观更新快照并广播，再转发命令（客户端不回执，后台快照为准）。 */
  private setObjectOption(objectId: string, option: string) {
    const clientSocket = this.getClientSocket();
    if (!clientSocket) {
      this.sendError('客户端未连接，无法设置选项');
      return;
    }
    if (gameState.setObjectOption(objectId, option)) {
      this.broadcast();
    }
    commands.setObjectOption(clientSocket, objectId, option);
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

  /** 取对象某组件的解析后数据（组件类型 + JSON 字符串数据；无组件或解析失败返回 null）。 */
  private componentParams(
    obj: { componentData?: Array<{ component: string; data: string }> } | undefined,
    component: string
  ): any {
    if (!obj || !obj.componentData) return null;
    const block = obj.componentData.find((c) => c.component === component);
    if (!block) return null;
    try {
      return JSON.parse(block.data || '{}');
    } catch {
      return null;
    }
  }

  /** 道具名 -> 总库存（多个同名 ItemExchange 组件的 quantity 累加；非法 quantity 不计入）。 */
  private itemStock(): Record<string, number> {
    // Object.create(null)：itemName 来自不可信上报，防 __proto__ 键污染
    const stock: Record<string, number> = Object.create(null);
    for (const obj of Object.values(gameState.objects)) {
      const params = this.componentParams(obj, 'ItemExchange');
      const q = params?.quantity;
      if (params && isNonEmptyString(params.itemName) && Number.isFinite(q) && q >= 0) {
        stock[params.itemName] = (stock[params.itemName] || 0) + q;
      }
    }
    return stock;
  }

  /** 按新物品列表计算：是否会导致某道具名的玩家持有总数超过总库存。只统计已注册玩家持有，与 GM 页面口径一致。 */
  private wouldExceedStock(objectId: string, newItems: string[]): boolean {
    if (!Array.isArray(newItems)) return false; // 畸形输入兜底（handler 入口已校验）
    const stock = this.itemStock();
    if (Object.keys(stock).length === 0) return false;

    const counts: Record<string, number> = Object.create(null);
    for (const pid of Object.keys(gameState.players)) {
      if (pid === objectId) continue;
      const obj = gameState.objects[pid];
      const params = this.componentParams(obj, 'Backpack');
      // Backpack data 可能被写入脏数据，非数组不计数
      if (Array.isArray(params?.items)) {
        for (const it of params.items) counts[it] = (counts[it] || 0) + 1;
      }
    }
    for (const it of newItems) counts[it] = (counts[it] || 0) + 1;

    for (const name of Object.keys(stock)) {
      if ((counts[name] || 0) > stock[name]) return true;
    }
    return false;
  }
}
