export type ClientMessage =
  | { type: 'request_join' }
  | {
      type: 'register_map_objects';
      mapName: string;
      spawnPoints: Array<{ id: string }>;
      /** 所有 BackendObject 的通用状态信息（GM 页面展示与切换状态） */
      objects?: Array<{
        id: string;
        /** 显示名称（GM 页面标明这是什么物体） */
        name?: string;
        kind?: string;
        currentState?: string | null;
        states?: string[];
        /** 归一化位置 [0,1]，y 向下（用于在地图上定位目标） */
        position?: { x: number; y: number } | null;
      }>;
    }
  | { type: 'register_players'; players: Array<{ id: string; name: string }> }
  | { type: 'request_teleport'; mapName: string; spawnId: string }
  | {
      type: 'report_player_position';
      playerId: string;
      /** 归一化图片坐标 [0,1]，y 向下 */
      position: { x: number; y: number };
      /** 玩家当前所在的地图 */
      mapName: string;
    }
  /** 客户端 BackendObject 状态变化后的回执，保持 GM 页面同步 */
  | { type: 'report_object_state'; objectId: string; state: string };

export type ServerMessage =
  | { type: 'sync_state'; state: GameStateSnapshot }
  | { type: 'set_map'; mapName: string; spawnId: string }
  | { type: 'teleport_player'; mapName: string; spawnId: string }
  /** 按对象 ID 切换客户端后台对象的状态（名称由客户端 Inspector 状态列表定义） */
  | { type: 'set_object_state'; objectId: string; state: string };

export type GmMessage =
  | { type: 'gm_teleport_player'; mapName: string; spawnId: string }
  | { type: 'gm_set_object_state'; objectId: string; state: string }
  | { type: 'gm_refresh' };

export interface PlayerStateSnapshot {
  name: string;
  /** 归一化图片坐标 [0,1]，y 向下 */
  position: { x: number; y: number };
  /** 玩家当前所在的地图 */
  mapName: string;
}

/** 通用后台对象（BackendObject）状态快照 */
export interface ObjectStateSnapshot {
  /** 显示名称（GM 页面标明这是什么物体）；未上报时回退为对象 id */
  name: string;
  /** 对象类型显示名（Door / SpawnPoint / Player ...） */
  kind: string;
  /** 当前状态名称；未配置状态时为 null */
  currentState: string | null;
  /** 全部可选状态名称 */
  states: string[];
  /** 对象所在的地图 */
  mapName: string;
  /** 归一化位置 [0,1]，y 向下；未上报时为 null */
  position: { x: number; y: number } | null;
}

export interface GameStateSnapshot {
  currentMap: string;
  players: Record<string, PlayerStateSnapshot>;
  /** mapName -> spawn point ids */
  spawnPoints: Record<string, Array<{ id: string }>>;
  /** objectId -> 通用后台对象状态 */
  objects: Record<string, ObjectStateSnapshot>;
}

export type GmUpdateMessage = {
  type: 'gm_update';
  state: GameStateSnapshot;
};
