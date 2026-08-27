/**
 * 开发辅助：把 Unity 客户端的可观看地图贴图同步到后台自持目录（默认 backend/maps）。
 *
 * 用法：
 *   npm run sync:maps
 *
 * 客户端资源目录可用环境变量 DICETALE_CLIENT_ASSETS 覆盖
 * （默认相对 backend/ 的 ../client/Assets/DiceTale）。同步目标为 config.mapsDir。
 */
import fs from 'fs';
import path from 'path';
import { config, BACKEND_ROOT } from '../src/config';
import { isViewableMapFile } from '../src/mapAssets';

const CLIENT_ASSETS_DIR = process.env.DICETALE_CLIENT_ASSETS
  ? path.resolve(process.env.DICETALE_CLIENT_ASSETS)
  : path.join(BACKEND_ROOT, '..', 'client', 'Assets', 'DiceTale');

/** 客户端地图贴图目录（GM 控制台可见的地图 PNG，不含 ACT/FX/Room/Carriage 等美术素材） */
const TEXTURES_DIR = path.join(CLIENT_ASSETS_DIR, 'Res', 'Textures');

function sync() {
  const dest = config.mapsDir;
  fs.mkdirSync(dest, { recursive: true });

  if (!fs.existsSync(TEXTURES_DIR)) {
    console.warn(`[sync-maps] 源目录不存在，跳过: ${TEXTURES_DIR}`);
    return;
  }

  let copied = 0;
  for (const file of fs.readdirSync(TEXTURES_DIR)) {
    if (!isViewableMapFile(file)) continue;
    fs.copyFileSync(path.join(TEXTURES_DIR, file), path.join(dest, file));
    copied++;
    console.log(`[sync-maps] ${file}`);
  }

  console.log(`[sync-maps] 完成：共同步 ${copied} 个文件 -> ${dest}`);
}

sync();
