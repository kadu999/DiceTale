export type ClientMessage =
  | { type: 'request_join' }
  | {
      type: 'register_map_objects';
      mapName: string;
      spawnPoints: Array<{ id: string }>;
      /** 所有后台物体的通用状态信息（GM 页面展示与切换状态） */
      objects?: Array<{
        id: string;
        /** 显示名称（GM 页面标明这是什么物体） */
        name?: string;
        kind?: string;
        currentState?: string | null;
        states?: string[];
        /** 道具名（道具对象上报，供 GM 页面分配道具） */
        itemName?: string;
        /** 道具总数量（道具对象固定库存） */
        quantity?: number;
        /** 归一化位置 [0,1]，y 向下（用于在地图上定位目标） */
        position?: { x: number; y: number } | null;
        /** 物品列表（字符串） */
        items?: string[];
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
  /** 客户端后台物体状态变化后的回执，保持 GM 页面同步 */
  | { type: 'report_object_state'; objectId: string; state: string }
  /** 对象物品列表（字符串）变化后的回执 */
  | { type: 'report_object_items'; objectId: string; items: string[] }
  /** 应用层心跳：客户端周期上报，供后台检测连接是否半开 */
  | { type: 'heartbeat' };

export type ServerMessage =
  | { type: 'sync_state'; state: GameStateSnapshot }
  | { type: 'set_map'; mapName: string; spawnId: string }
  | { type: 'teleport_player'; mapName: string; spawnId: string }
  /** 按对象 ID 切换客户端后台对象的状态（名称由客户端 Inspector 状态列表定义） */
  | { type: 'set_object_state'; objectId: string; state: string }
  /** 整体设置对象物品列表 */
  | { type: 'set_object_items'; objectId: string; items: string[] };

export type GmMessage =
  | { type: 'gm_teleport_player'; mapName: string; spawnId: string }
  | { type: 'gm_set_object_state'; objectId: string; state: string }
  | { type: 'gm_set_object_items'; objectId: string; items: string[] };

export interface PlayerStateSnapshot {
  name: string;
  /** 归一化图片坐标 [0,1]，y 向下 */
  position: { x: number; y: number };
  /** 玩家当前所在的地图 */
  mapName: string;
}

/** 通用后台物体（SceneObject）状态快照 */
export interface ObjectStateSnapshot {
  /** 显示名称（GM 页面标明这是什么物体）；未上报时回退为对象 id */
  name: string;
  /** 对象类型显示名（SpawnPoint / Player ...） */
  kind: string;
  /** 当前状态名称；未配置状态时为 null */
  currentState: string | null;
  /** 全部可选状态名称 */
  states: string[];
  /** 道具名（道具对象上报，供 GM 页面分配道具；非道具对象不设置） */
  itemName?: string;
  /** 道具总数量（道具对象固定库存） */
  quantity?: number;
  /** 对象所在的地图 */
  mapName: string;
  /** 归一化位置 [0,1]，y 向下；未上报时为 null */
  position: { x: number; y: number } | null;
  /** 物品列表（字符串） */
  items: string[];
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
  /** 客户端是否在线（单客户端架构：断开即无客户端，页面据此显示状态） */
  clientConnected: boolean;
};

/** 后台 → GM 控制台的消息 */
export type GmServerMessage =
  | GmUpdateMessage
  | { type: 'gm_error'; reason: string }
  | { type: 'sync_state'; state: GameStateSnapshot };
