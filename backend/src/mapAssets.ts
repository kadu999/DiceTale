import fs from 'fs';
import path from 'path';

/**
 * 地图资源筛选：只有「可观看地图」图片才进入 GM 地图列表。
 * 过滤美术素材包遗留（ACT/FX/Room/Carriage 开头的图集与 __v 版本号文件）。
 */
export function isViewableMapFile(fileName: string): boolean {
  return (
    /\.png$/i.test(fileName) &&
    !/^(ACT|FX|Room)/i.test(fileName) &&
    !/^Carriage/i.test(fileName) &&
    !/__v\d/i.test(fileName)
  );
}

/** 扫描 mapsDir，列出可观看地图（只读，供 GM 浏览所有地图）。 */
export function listMaps(mapsDir: string): Array<{ name: string; image: string }> {
  if (!fs.existsSync(mapsDir)) return [];

  return fs
    .readdirSync(mapsDir)
    .filter(isViewableMapFile)
    .sort()
    .map((f) => ({ name: f.replace(/\.png$/i, ''), image: `/maps/${f}` }));
}

/** 从 mapsDir 解析 /maps/{fileName} 对应的磁盘文件；不存在或不是文件时返回 null。 */
export function resolveMapAsset(mapsDir: string, fileName: string): string | null {
  const safeName = path.basename(fileName);
  const candidate = path.join(mapsDir, safeName);
  if (!fs.existsSync(candidate) || !fs.statSync(candidate).isFile()) return null;
  return candidate;
}
