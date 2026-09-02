export interface Position {
  x: number;
  y: number;
}

export interface PlayerInfo {
  playerId: string;
  name?: string;
  mapName?: string | null;
  position?: Position | null;
}

export interface ObjectInfo {
  objectId: string;
  name?: string;
  kind?: string;
  mapName?: string | null;
  position?: Position | null;
  componentData?: unknown; // JSON string or already-parsed array from WebSocket
}

export interface ComponentBlock {
  component: string;
  displayName?: string;
  data: Record<string, unknown>;
}

export interface EraseStroke {
  points: Position[];
  radius: number;
  softness: number;
  done?: boolean;
}

export type ClientMessage =
  | { type: 'register_players'; players: PlayerInfo[] }
  | { type: 'register_map_objects'; mapName: string; objects: ObjectInfo[]; spawnPoints?: Record<string, string[]> }
  | { type: 'report_player_position'; playerId: string; position: Position; mapName: string }
  | { type: 'report_object_position'; objectId: string; position: Position; mapName: string }
  | { type: 'gm_set_option'; objectId: string; option: string }
  | { type: 'gm_set_int'; objectId: string; value: number }
  | { type: 'gm_set_float'; objectId: string; value: number }
  | { type: 'gm_set_bool'; objectId: string; value: boolean }
  | { type: 'gm_set_object_items'; objectId: string; items: string[] }
  | { type: 'gm_erase_mask'; objectId: string; stroke: EraseStroke }
  | { type: 'sync_state' }
  | { type: 'heartbeat' };

export interface GameStateSnapshot {
  currentMap: string;
  players: Record<string, PlayerInfo>;
  objects: Record<string, ObjectInfo>;
  spawnPoints: Record<string, Record<string, string[]>>;
}

export type ServerMessage =
  | { type: 'gm_update'; state: GameStateSnapshot; clientConnected: boolean }
  | { type: 'gm_error'; reason: string };
