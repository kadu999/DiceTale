import fs from 'fs';
import path from 'path';

/**
 * 后台配置。
 *
 * 配置优先级（高 → 低）：
 *   1. 环境变量 PORT / MAPS_DIR
 *   2. backend/config.json（DICETALE_CONFIG 可指定其它配置文件路径）
 *   3. 内置默认值
 *
 * mapsDir 支持相对路径（相对 backend/ 目录）或绝对路径，
 * 最终统一解析为绝对路径，供 /maps/* 与 /api/maps 使用。
 */
export interface BackendConfig {
  port: number;
  /** 地图贴图目录（绝对路径）：GM 控制台显示的 *.png 地图贴图 */
  mapsDir: string;
}

/** backend/ 根目录（src/ 或 dist/ 的上层） */
export const BACKEND_ROOT = path.join(__dirname, '..');

function loadConfigFile(): Partial<{ port: number; mapsDir: string }> {
  const configPath = process.env.DICETALE_CONFIG || path.join(BACKEND_ROOT, 'config.json');
  try {
    const raw = fs.readFileSync(configPath, 'utf-8');
    return JSON.parse(raw) as Partial<{ port: number; mapsDir: string }>;
  } catch {
    // 配置文件缺失或损坏时回退到默认值
    return {};
  }
}

function resolveMapsDir(raw: string | undefined): string {
  const dir = raw || 'maps';
  return path.isAbsolute(dir) ? dir : path.resolve(BACKEND_ROOT, dir);
}

export const config: BackendConfig = (() => {
  const file = loadConfigFile();
  const port = parseInt(process.env.PORT || String(file.port ?? 1420), 10);
  const mapsDir = resolveMapsDir(process.env.MAPS_DIR || file.mapsDir);
  return { port, mapsDir };
})();
