import { GameStateSnapshot } from './types';

export interface DoorInfo {
  unlocked: boolean;
  targetMap: string;
  targetSpawn: string;
  isPortal: boolean;
  mapName: string;
  position: { x: number; y: number };
}

export interface SpawnPointInfo {
  id: string;
}

export interface PlayerInfo {
  name: string;
  position: { x: number; y: number };
  mapName: string;
}

export class GameState {
  currentMap = 'Map001';
  players: Record<string, PlayerInfo> = {};
  doors: Record<string, DoorInfo> = {};
  spawnPoints: Record<string, SpawnPointInfo[]> = {};
  /** 跨重启记忆的门解锁状态（doorId -> unlocked）。门本体由客户端上报，不持久化。 */
  doorUnlocked: Record<string, boolean> = {};

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

  /**
   * 注册/更新门信息。以 doorId 为全局键合并：
   * - unlocked 状态取 doorUnlocked 记忆（跨重启保留，客户端主导门本体）；
   * - targetMap / targetSpawn / isPortal / position / mapName 以最新上报为准。
   */
  registerDoors(
    mapName: string,
    doors: Array<
      Partial<DoorInfo> & {
        id: string;
        targetMap: string;
        targetSpawn: string;
        isPortal: boolean;
      }
    >
  ) {
    for (const door of doors) {
      const existing = this.doors[door.id];
      this.doors[door.id] = {
        unlocked: this.doorUnlocked[door.id] ?? existing?.unlocked ?? false,
        targetMap: door.targetMap,
        targetSpawn: door.targetSpawn,
        isPortal: door.isPortal,
        mapName: door.mapName ?? existing?.mapName ?? mapName,
        position: door.position ?? existing?.position ?? { x: 0.5, y: 0.5 },
      };
    }
  }

  registerSpawnPoints(mapName: string, spawnPoints: SpawnPointInfo[]) {
    this.spawnPoints[mapName] = spawnPoints;
  }

  setDoorUnlocked(doorId: string, unlocked = true): boolean {
    const door = this.doors[doorId];
    if (!door) return false;
    door.unlocked = unlocked;
    this.doorUnlocked[doorId] = unlocked;
    return true;
  }

  getSnapshot(): GameStateSnapshot {
    return {
      currentMap: this.currentMap,
      players: JSON.parse(JSON.stringify(this.players)),
      doors: JSON.parse(JSON.stringify(this.doors)),
      spawnPoints: JSON.parse(JSON.stringify(this.spawnPoints)),
    };
  }
}

export const gameState = new GameState();
