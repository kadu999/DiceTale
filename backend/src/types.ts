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
        /** 对象所在的地图 */
        mapName?: string;
        /** 归一化位置 [0,1]，y 向下（用于在地图上定位目标） */
        position?: { x: number; y: number } | null;
        /** 能力组件数据段：组件类型 + JSON 字符串数据（GM/后端按组件类型解析） */
        componentData?: Array<{ component: string; data: string }>;
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
  /** 通用主体位置上报（门/机关等普通对象移动后更新 objects 中的位置） */
  | {
      type: 'report_object_position';
      objectId: string;
      /** 归一化图片坐标 [0,1]，y 向下 */
      position: { x: number; y: number };
      /** 主体当前所在的地图 */
      mapName: string;
    }
  /** 应用层心跳：客户端周期上报，供后台检测连接是否半开 */
  | { type: 'heartbeat' };

export type ServerMessage =
  | { type: 'sync_state'; state: GameStateSnapshot }
  | { type: 'set_map'; mapName: string; spawnId: string }
  | { type: 'teleport_player'; mapName: string; spawnId: string }
  /** 按对象 ID 切换客户端后台对象的状态（名称由客户端 Inspector 状态列表定义） */
  | { type: 'set_object_state'; objectId: string; state: string }
  /** 整体设置对象物品列表 */
  | { type: 'set_object_items'; objectId: string; items: string[] }
  /** 应用 GM 擦除后的遮罩图（base64 PNG，遮罩对象） */
  | { type: 'set_mask_image'; objectId: string; image: string }
  /** 转发 GM 擦除遮罩的笔画轨迹（客户端 shader 计算软边） */
  | { type: 'erase_mask'; objectId: string; stroke: EraseStroke }
  /** 设置对象浮点参数（FloatValue 组件） */
  | { type: 'set_float'; objectId: string; value: number }
  /** 设置对象整数参数（IntValue 组件） */
  | { type: 'set_int'; objectId: string; value: number }
  /** 设置对象布尔参数（BoolValue 组件） */
  | { type: 'set_bool'; objectId: string; value: boolean };

export type GmMessage =
  | { type: 'gm_teleport_player'; mapName: string; spawnId: string }
  | { type: 'gm_set_object_state'; objectId: string; state: string }
  | { type: 'gm_set_object_items'; objectId: string; items: string[] }
  | { type: 'gm_set_mask_image'; objectId: string; image: string }
  /** GM 擦除遮罩的笔画轨迹（软边由客户端 shader 计算） */
  | { type: 'gm_erase_mask'; objectId: string; stroke: EraseStroke }
  /** GM 设置对象浮点参数（FloatValue 组件） */
  | { type: 'gm_set_float'; objectId: string; value: number }
  /** GM 设置对象整数参数（IntValue 组件） */
  | { type: 'gm_set_int'; objectId: string; value: number }
  /** GM 设置对象布尔参数（BoolValue 组件） */
  | { type: 'gm_set_bool'; objectId: string; value: boolean };

/** 遮罩擦除笔画：归一化轨迹点 + 归一化半径（相对纹理宽度）+ 软边羽化比例。
 *  done：拖动中增量发送时为 false，笔画结束时最后一帧为 true（客户端当前不区分）。 */
export interface EraseStroke {
  points: Array<{ x: number; y: number }>;
  radius: number;
  softness: number;
  done?: boolean;
}

export interface PlayerStateSnapshot {
  name: string;
  /** 归一化图片坐标 [0,1]，y 向下 */
  position: { x: number; y: number };
  /** 玩家当前所在的地图 */
  mapName: string;
}

/** 通用后台物体（BackendObject 枢纽）状态快照 */
export interface ObjectStateSnapshot {
  /** 显示名称（GM 页面标明这是什么物体）；未上报时回退为对象 id */
  name: string;
  /** 对象类型显示名（SceneObject / Player / Item / Event） */
  kind: string;
  /** 对象所在的地图 */
  mapName: string;
  /** 归一化位置 [0,1]，y 向下；未上报时为 null */
  position: { x: number; y: number } | null;
  /** 能力组件数据段：组件类型 + JSON 字符串数据（GM 按组件类型解析渲染控件） */
  componentData?: Array<{ component: string; data: string }>;
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
