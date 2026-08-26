import { GameStateSnapshot } from './types';

export interface SpawnPointInfo {
  id: string;
}

export interface PlayerInfo {
  name: string;
  position: { x: number; y: number };
  mapName: string;
}

export interface ObjectInfo {
  name: string;
  kind: string;
  currentState: string | null;
  states: string[];
  mapName: string;
  position: { x: number; y: number } | null;
}

export class GameState {
  currentMap = 'Map001';
  players: Record<string, PlayerInfo> = {};
  spawnPoints: Record<string, SpawnPointInfo[]> = {};
  /** 通用后台对象（BackendObject）：objectId -> 状态信息（对象本体由客户端主导，不持久化） */
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

  registerSpawnPoints(mapName: string, spawnPoints: SpawnPointInfo[]) {
    this.spawnPoints[mapName] = spawnPoints;
  }

  /** 注册/更新通用后台对象状态信息（按 objectId 合并，保留未上报字段）。 */
  registerObjects(
    mapName: string,
    objects: Array<Partial<ObjectInfo> & { id: string }>
  ) {
    for (const obj of objects) {
      const existing = this.objects[obj.id];
      this.objects[obj.id] = {
        name: obj.name ?? existing?.name ?? obj.id,
        kind: obj.kind ?? existing?.kind ?? 'object',
        currentState: obj.currentState ?? existing?.currentState ?? null,
        states: obj.states ?? existing?.states ?? [],
        mapName: obj.mapName ?? existing?.mapName ?? mapName,
        position: obj.position ?? existing?.position ?? null,
      };
    }
  }

  /** 更新通用后台对象当前状态（客户端 report_object_state 回执）。 */
  setObjectState(objectId: string, state: string): boolean {
    const obj = this.objects[objectId];
    if (!obj) return false;
    obj.currentState = state;
    return true;
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
