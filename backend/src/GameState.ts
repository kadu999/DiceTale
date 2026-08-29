import { GameStateSnapshot } from './types';

export interface SpawnPointInfo {
  id: string;
}

export interface PlayerInfo {
  name: string;
  position: { x: number; y: number };
  mapName: string;
}

export interface ComponentBlock {
  component: string;
  /** 组件显示名（GM 属性面板分区标题，如「状态机」「背包」） */
  displayName?: string;
  data: string;
}

export interface ObjectInfo {
  name: string;
  kind: string;
  mapName: string;
  position: { x: number; y: number } | null;
  /** 能力组件数据段：组件类型 + JSON 字符串数据（后端透传，GM 按组件类型解析） */
  componentData?: ComponentBlock[];
}

export class GameState {
  currentMap = 'Map001';
  players: Record<string, PlayerInfo> = {};
  spawnPoints: Record<string, SpawnPointInfo[]> = {};
  /** 通用后台物体（BackendObject 枢纽）：objectId -> 状态信息（对象本体由客户端主导，不持久化） */
  objects: Record<string, ObjectInfo> = {};

  setMap(mapName: string, _spawnId?: string) {
    this.currentMap = mapName;
  }

  /** 注册/更新玩家名单（保留已上报的位置与地图）。 */
  registerPlayers(players: Array<{ id: string; name: string }>) {
    for (const player of players) {
      const existing = this.players[player.id];
      this.players[player.id] = {
        name: player.name || player.id,
        position: existing?.position ?? { x: 0.5, y: 0.5 },
        mapName: existing?.mapName ?? this.currentMap,
      };
    }
  }

  /** 客户端断开时清空其上报的运行时数据（玩家/对象/出生点；单客户端架构：断开 = 没有客户端）。 */
  clearClientData() {
    this.players = {};
    this.objects = {};
    this.spawnPoints = {};
  }

  /** 更新玩家位置（归一化图片坐标 + 所在地图）。 */
  setPlayerPosition(playerId: string, position: { x: number; y: number }, mapName: string) {
    const player = this.players[playerId];
    if (!player) {
      // 未知玩家：按 id 注册，name 用 id
      this.players[playerId] = { name: playerId, position, mapName };
      return;
    }
    player.position = position;
    player.mapName = mapName;
  }

  /** 更新通用后台对象的位置（客户端 report_object_position 上报）；对象不存在时忽略。 */
  updateObjectPosition(objectId: string, position: { x: number; y: number }, mapName: string): boolean {
    const obj = this.objects[objectId];
    if (!obj) return false;
    obj.position = position;
    obj.mapName = mapName;
    return true;
  }

  registerSpawnPoints(mapName: string, spawnPoints: SpawnPointInfo[]) {
    this.spawnPoints[mapName] = spawnPoints;
  }

  /**
   * 注册/更新通用后台对象状态信息。
   * 客户端每次上报的是当前世界的完整对象集合：整体替换（未再上报的对象视为已销毁，直接移除），
   * 避免旧地图残留对象（幽灵）或跨图串图；mapName 以客户端上报为准（缺省用消息地图名）。
   */
  registerObjects(
    mapName: string,
    objects: Array<Partial<ObjectInfo> & { id: string }>
  ) {
    const next: Record<string, ObjectInfo> = {};
    for (const obj of objects) {
      const existing = this.objects[obj.id];
      next[obj.id] = {
        name: obj.name ?? existing?.name ?? obj.id,
        kind: obj.kind ?? existing?.kind ?? 'object',
        mapName: obj.mapName ?? existing?.mapName ?? mapName,
        position: obj.position ?? existing?.position ?? null,
        componentData: obj.componentData ?? existing?.componentData,
      };
    }
    this.objects = next;
  }

  /** 更新对象指定组件的一个 JSON 字段并回写 data 字符串（乐观更新；客户端不回执）。
   *  组件数据是「组件类型 + JSON 字符串」，按组件定位后解析、改字段、再序列化。 */
  private updateComponentParam(
    objectId: string,
    component: string,
    mutate: (params: any) => void
  ): boolean {
    const obj = this.objects[objectId];
    if (!obj || !obj.componentData) return false;
    const block = obj.componentData.find((c) => c.component === component);
    if (!block) return false;
    let params: any;
    try {
      params = JSON.parse(block.data || '{}');
    } catch {
      return false;
    }
    mutate(params);
    block.data = JSON.stringify(params);
    return true;
  }

  /** 更新通用后台对象当前选项（GM 下发 set_option 时的乐观更新；客户端不回执）。 */
  setObjectOption(objectId: string, option: string): boolean {
    return this.updateComponentParam(objectId, 'OptionValue', (p) => {
      p.currentOption = option;
    });
  }

  /** 更新通用后台对象物品列表（GM 下发 set_object_items 时的乐观更新；客户端不回执）。 */
  setObjectItems(objectId: string, items: string[]): boolean {
    return this.updateComponentParam(objectId, 'Backpack', (p) => {
      p.items = items;
    });
  }

  /** 更新对象浮点参数（GM 下发 set_float 时的乐观更新；客户端不回执）。 */
  setObjectFloat(objectId: string, value: number): boolean {
    return this.updateComponentParam(objectId, 'FloatValue', (p) => {
      p.value = value;
    });
  }

  /** 更新对象整数参数（GM 下发 set_int 时的乐观更新；客户端不回执）。 */
  setObjectInt(objectId: string, value: number): boolean {
    return this.updateComponentParam(objectId, 'IntValue', (p) => {
      p.value = value;
    });
  }

  /** 更新对象布尔参数（GM 下发 set_bool 时的乐观更新；客户端不回执）。 */
  setObjectBool(objectId: string, value: boolean): boolean {
    return this.updateComponentParam(objectId, 'BoolValue', (p) => {
      p.value = value;
    });
  }

  getSnapshot(): GameStateSnapshot {
    return {
      currentMap: this.currentMap,
      players: JSON.parse(JSON.stringify(this.players)),
      spawnPoints: JSON.parse(JSON.stringify(this.spawnPoints)),
      objects: JSON.parse(JSON.stringify(this.objects)),
    };
  }
}

export const gameState = new GameState();
