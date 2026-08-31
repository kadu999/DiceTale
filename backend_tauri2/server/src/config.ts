import fs from 'fs';
import path from 'path';

/**
 * 后台配置。
 *
 * 配置优先级（高 → 低）：
 *   1. 环境变量 PORT / MAPS_DIR / DEBUG_WS / MAX_MESSAGE_MB
 *   2. server/config.json（DICETALE_CONFIG 可指定其它配置文件路径）
 *   3. 内置默认值
 *
 * mapsDir 支持相对路径（相对 backend/ 目录）或绝对路径，
 * 最终统一解析为绝对路径，供 /maps/* 与 /api/maps 使用。
 */
export interface BackendConfig {
  port: number;
  /** 地图贴图目录（绝对路径）：GM 控制台显示的 *.png 地图贴图 */
  mapsDir: string;
  /** 打印 WS 升级请求调试日志（排查手机端握手失败）；默认关闭 */
  debugWs: boolean;
  /** 单条 WS 消息大小上限（MB）：遮罩图等大消息的上限，防止异常消息撑爆内存 */
  maxMessageMb: number;
}

/** backend/ 根目录（src/ 或 dist/ 的上层） */
export const BACKEND_ROOT = path.join(__dirname, '..');

interface ConfigFile {
  port?: number;
  mapsDir?: string;
  debugWs?: boolean;
  maxMessageMb?: number;
}

function loadConfigFile(): ConfigFile {
  const configPath = process.env.DICETALE_CONFIG || path.join(BACKEND_ROOT, 'config.json');
  try {
    const raw = fs.readFileSync(configPath, 'utf-8');
    return JSON.parse(raw) as ConfigFile;
  } catch {
    // 配置文件缺失或损坏时回退到默认值
    return {};
  }
}

function parseBool(v: unknown): boolean {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') return v === '1' || v.toLowerCase() === 'true';
  return false;
}

function parsePositiveInt(v: unknown, fallback: number): number {
  if (typeof v === 'number' && Number.isFinite(v) && v > 0) return Math.floor(v);
  if (typeof v === 'string') {
    const n = parseInt(v, 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return fallback;
}

function resolveMapsDir(raw: string | undefined): string {
  const dir = raw || 'maps';
  return path.isAbsolute(dir) ? dir : path.resolve(BACKEND_ROOT, dir);
}

export const config: BackendConfig = (() => {
  const file = loadConfigFile();
  const port = parseInt(process.env.PORT || String(file.port ?? 1420), 10);
  const mapsDir = resolveMapsDir(process.env.MAPS_DIR || file.mapsDir);
  const debugWs = parseBool(process.env.DEBUG_WS ?? file.debugWs);
  const maxMessageMb = parsePositiveInt(process.env.MAX_MESSAGE_MB ?? file.maxMessageMb, 16);
  return { port, mapsDir, debugWs, maxMessageMb };
})();
