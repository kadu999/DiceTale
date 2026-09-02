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
  const explicit = !!process.env.DICETALE_CONFIG;
  const configPath = process.env.DICETALE_CONFIG || path.join(BACKEND_ROOT, 'config.json');
  try {
    const raw = fs.readFileSync(configPath, 'utf-8');
    const parsed = JSON.parse(raw);
    // 合法 JSON 但形状非法（null/数组/标量）同样回退默认，不能直接把 null 当配置用
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      console.warn(`[Config] ${configPath} 的内容不是 JSON 对象，已忽略（回退默认配置）`);
      return {};
    }
    return parsed as ConfigFile;
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    // 默认路径下文件不存在属正常（首次运行），静默回退；显式指定或语法错误必须提示，否则"改了配置不生效"毫无线索
    if (e.code !== 'ENOENT' || explicit) {
      console.warn(`[Config] 无法加载配置文件 ${configPath}：${e.message}（回退默认配置）`);
    }
    return {};
  }
}

function parseBool(v: unknown): boolean {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') return v === '1' || v.toLowerCase() === 'true';
  return false;
}

/** 严格正整数解析：Number + isInteger，不容忍 "16abc" 这类垃圾后缀。 */
function parsePositiveInt(v: unknown, fallback: number): number {
  const n = typeof v === 'string' ? (v.trim() === '' ? NaN : Number(v)) : v;
  if (typeof n === 'number' && Number.isInteger(n) && n > 0) return n;
  return fallback;
}

/** 端口解析：非法值（非 1-65535 整数）直接报错，避免 listen(NaN) 在 error 处理器之外裸抛堆栈。 */
function parsePort(v: unknown): number {
  if (v === undefined || v === null) return 1420;
  const n = typeof v === 'string' ? Number(v) : v;
  if (typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= 65535) return n;
  throw new Error(`[Config] 非法端口 ${JSON.stringify(v)}：应为 1-65535 的整数（来源：PORT 环境变量或 server/config.json 的 port）`);
}

function resolveMapsDir(raw: string | undefined): string {
  // 配置文件里 mapsDir 形状非法（如数字）时回退默认目录，而不是让 path.isAbsolute 抛 TypeError
  const dir = typeof raw === 'string' && raw ? raw : 'maps';
  return path.isAbsolute(dir) ? dir : path.resolve(BACKEND_ROOT, dir);
}

export const config: BackendConfig = (() => {
  const file = loadConfigFile();
  const port = parsePort(process.env.PORT ?? file.port);
  const mapsDir = resolveMapsDir(process.env.MAPS_DIR || file.mapsDir);
  const debugWs = parseBool(process.env.DEBUG_WS ?? file.debugWs);
  const maxMessageMb = parsePositiveInt(process.env.MAX_MESSAGE_MB ?? file.maxMessageMb, 16);
  return { port, mapsDir, debugWs, maxMessageMb };
})();
