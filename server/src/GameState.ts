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

export class GameState {
  currentMap = 'Map001';
  player = { position: { x: 0, y: 0 } };
  doors: Record<string, DoorInfo> = {};
  spawnPoints: Record<string, SpawnPointInfo[]> = {};

  setMap(mapName: string, _spawnId?: string) {
    this.currentMap = mapName;
  }

  /**
   * 注册/更新门信息。以 doorId 为全局键合并：
   * - unlocked 状态跨地图保留（服务器是权威状态源）；
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
        unlocked: existing?.unlocked ?? false,
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
    return true;
  }

  setPlayerPosition(position: { x: number; y: number }) {
    this.player.position = position;
  }

  getSnapshot(): GameStateSnapshot {
    return {
      currentMap: this.currentMap,
      player: { position: { ...this.player.position } },
      doors: JSON.parse(JSON.stringify(this.doors)),
      spawnPoints: JSON.parse(JSON.stringify(this.spawnPoints)),
    };
  }
}

export const gameState = new GameState();
