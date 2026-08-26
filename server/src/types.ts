export type ClientMessage =
  | { type: 'request_join' }
  | {
      type: 'register_map_objects';
      mapName: string;
      doors: Array<{
        id: string;
        targetMap: string;
        targetSpawn: string;
        isPortal: boolean;
        /** 可选：归一化位置 [0,1]，y 向下；不传则保留服务器目录中的位置 */
        position?: { x: number; y: number };
      }>;
      spawnPoints: Array<{ id: string }>;
    }
  | { type: 'register_players'; players: Array<{ id: string; name: string }> }
  | { type: 'request_door_access'; doorId: string }
  | { type: 'request_teleport'; mapName: string; spawnId: string }
  | {
      type: 'report_player_position';
      playerId: string;
      /** 归一化图片坐标 [0,1]，y 向下 */
      position: { x: number; y: number };
      /** 玩家当前所在的地图 */
      mapName: string;
    };

export type ServerMessage =
  | { type: 'sync_state'; state: GameStateSnapshot }
  | { type: 'set_map'; mapName: string; spawnId: string }
  | { type: 'set_door_state'; doorId: string; unlocked: boolean }
  | { type: 'teleport_player'; mapName: string; spawnId: string };

export type GmMessage =
  | { type: 'gm_open_door'; doorId: string }
  | { type: 'gm_close_door'; doorId: string }
  | { type: 'gm_teleport_player'; mapName: string; spawnId: string }
  | { type: 'gm_refresh' };

export interface DoorStateSnapshot {
  unlocked: boolean;
  targetMap: string;
  targetSpawn: string;
  isPortal: boolean;
  /** 门所在的地图 */
  mapName: string;
  /** 归一化位置 [0,1]，y 向下 */
  position: { x: number; y: number };
}

export interface PlayerStateSnapshot {
  name: string;
  /** 归一化图片坐标 [0,1]，y 向下 */
  position: { x: number; y: number };
  /** 玩家当前所在的地图 */
  mapName: string;
}

export interface GameStateSnapshot {
  currentMap: string;
  players: Record<string, PlayerStateSnapshot>;
  doors: Record<string, DoorStateSnapshot>;
  /** mapName -> spawn point ids */
  spawnPoints: Record<string, Array<{ id: string }>>;
}

export type GmUpdateMessage = {
  type: 'gm_update';
  state: GameStateSnapshot;
};
