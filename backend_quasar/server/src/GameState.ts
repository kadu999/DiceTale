import {
  ComponentBlock,
  GameStateSnapshot,
  ObjectStateSnapshot,
  PlayerStateSnapshot,
  SpawnPointInfo,
} from './types';

// 运行时状态与快照共用 types.ts 的同一组结构定义，避免两份平行定义字段漂移
export type { ComponentBlock, SpawnPointInfo };
export type PlayerInfo = PlayerStateSnapshot;
export type ObjectInfo = ObjectStateSnapshot;

export class GameState {
  currentMap = 'Map001';
  // Object.create(null)：id 来自不可信的客户端消息，防 __proto__ 等保留键污染原型链
  players: Record<string, PlayerInfo> = Object.create(null);
  spawnPoints: Record<string, SpawnPointInfo[]> = Object.create(null);
  /** 通用后台物体（BackendObject 枢纽）：objectId -> 状态信息（对象本体由客户端主导，不持久化） */
  objects: Record<string, ObjectInfo> = Object.create(null);

  setMap(mapName: string) {
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
    this.players = Object.create(null);
    this.objects = Object.create(null);
    this.spawnPoints = Object.create(null);
  }

  /** 更新玩家位置（归一化图片坐标 + 所在地图）；未知玩家忽略并返回 false（不自动注册，防止伪造 id 灌入玩家列表）。 */
  setPlayerPosition(playerId: string, position: { x: number; y: number }, mapName: string): boolean {
    const player = this.players[playerId];
    if (!player) return false;
    player.position = position;
    player.mapName = mapName;
    return true;
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
   * 避免旧地图残留对象（幽灵）或跨图串图；单条消息里未上报的字段（name/kind/mapName/position/componentData）
   * 保留旧值，新对象的 mapName 缺省用消息地图名。
   */
  registerObjects(
    mapName: string,
    objects: Array<Partial<ObjectInfo> & { id: string }>
  ) {
    const next: Record<string, ObjectInfo> = Object.create(null);
    for (const obj of objects) {
      const existing = this.objects[obj.id];
      next[obj.id] = {
        name: obj.name ?? existing?.name ?? obj.id,
        kind: obj.kind ?? existing?.kind ?? 'object',
        mapName: obj.mapName ?? existing?.mapName ?? mapName,
        // 'position' in obj 区分「未上报」（保留旧值）与「显式 null」（清除位置）
        position: 'position' in obj ? obj.position ?? null : existing?.position ?? null,
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

  /** 更新对象浮点参数（GM 下发 set_float 时的乐观更新；客户端不回执）。
   *  NaN/Infinity 经 JSON.stringify 会静默变 null（两端口径不一致），直接拒绝。 */
  setObjectFloat(objectId: string, value: number): boolean {
    if (!Number.isFinite(value)) return false;
    return this.updateComponentParam(objectId, 'FloatValue', (p) => {
      p.value = value;
    });
  }

  /** 更新对象整数参数（GM 下发 set_int 时的乐观更新；客户端不回执）。非整数直接拒绝。 */
  setObjectInt(objectId: string, value: number): boolean {
    if (!Number.isInteger(value)) return false;
    return this.updateComponentParam(objectId, 'IntValue', (p) => {
      p.value = value;
    });
  }

  /** 更新对象布尔参数（GM 下发 set_bool 时的乐观更新；客户端不回执）。 */
  setObjectBool(objectId: string, value: boolean): boolean {
    if (typeof value !== 'boolean') return false;
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
