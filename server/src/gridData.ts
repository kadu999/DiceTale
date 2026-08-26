import fs from 'fs';
import path from 'path';

/**
 * 网格数据：与 Unity GridMapData 二进制格式一致
 * (int gridSizeX + int gridSizeY + gridSizeX*gridSizeY 个 int 掩码，小端，行优先 y*width+x)。
 * 掩码：0=空 1=障碍 2=困难 4=水
 */

export interface GridData {
  gridSizeX: number;
  gridSizeY: number;
  /** 行优先的掩码数组 */
  cells: number[];
}

const DATA_DIR = path.join(__dirname, '..', 'data', 'maps');

const VALID_MASKS = new Set([0, 1, 2, 4]);

export function gridFilePath(name: string): string {
  return path.join(DATA_DIR, `${name}.bytes`);
}

export function parseGrid(bytes: Buffer): GridData | null {
  if (!bytes || bytes.length < 8) return null;

  const gridSizeX = bytes.readInt32LE(0);
  const gridSizeY = bytes.readInt32LE(4);
  if (gridSizeX <= 0 || gridSizeY <= 0 || gridSizeX > 4096 || gridSizeY > 4096) {
    return null;
  }

  const count = gridSizeX * gridSizeY;
  if (bytes.length !== 8 + count * 4) return null;

  const cells: number[] = new Array(count);
  for (let i = 0; i < count; i++) {
    const mask = bytes.readInt32LE(8 + i * 4);
    if (!VALID_MASKS.has(mask)) return null;
    cells[i] = mask;
  }

  return { gridSizeX, gridSizeY, cells };
}

export function serializeGrid(data: GridData): Buffer {
  const count = data.gridSizeX * data.gridSizeY;
  const buffer = Buffer.alloc(8 + count * 4);
  buffer.writeInt32LE(data.gridSizeX, 0);
  buffer.writeInt32LE(data.gridSizeY, 4);
  for (let i = 0; i < count; i++) {
    buffer.writeInt32LE(data.cells[i] ?? 0, 8 + i * 4);
  }
  return buffer;
}

export function loadGrid(name: string): GridData | null {
  const filePath = gridFilePath(name);
  if (!fs.existsSync(filePath)) return null;
  try {
    return parseGrid(fs.readFileSync(filePath));
  } catch (err) {
    console.error(`[GridData] Failed to load ${name}:`, err);
    return null;
  }
}

export function saveGrid(name: string, data: GridData): boolean {
  if (!/^[A-Za-z0-9_-]+$/.test(name)) return false;
  if (data.gridSizeX <= 0 || data.gridSizeY <= 0 || data.gridSizeX > 4096 || data.gridSizeY > 4096) {
    return false;
  }
  if (data.cells.length !== data.gridSizeX * data.gridSizeY) return false;
  for (const mask of data.cells) {
    if (!VALID_MASKS.has(mask)) return false;
  }

  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(gridFilePath(name), serializeGrid(data));
    return true;
  } catch (err) {
    console.error(`[GridData] Failed to save ${name}:`, err);
    return false;
  }
}

/** 客户端 Resources 目录（作为首次播种的来源） */
const CLIENT_RESOURCES_DIR = path.join(__dirname, '..', '..', 'client', 'Assets', 'DiceTale', 'Resources');

/**
 * 启动时把客户端 Resources 下的 *.bytes 播种到服务器数据目录（已存在则跳过）。
 * 之后服务器数据目录成为权威网格数据源。
 */
export function seedGrids(mapNames: string[]) {
  for (const name of mapNames) {
    const target = gridFilePath(name);
    if (fs.existsSync(target)) continue;

    const source = path.join(CLIENT_RESOURCES_DIR, `${name}.bytes`);
    if (!fs.existsSync(source)) {
      console.warn(`[GridData] No seed source for ${name} (${source})`);
      continue;
    }

    const data = parseGrid(fs.readFileSync(source));
    if (!data) {
      console.warn(`[GridData] Seed file invalid for ${name}`);
      continue;
    }

    saveGrid(name, data);
    console.log(`[GridData] Seeded ${name} grid (${data.gridSizeX}x${data.gridSizeY}) to server data`);
  }
}
