import fs from 'fs';
import path from 'path';
import { gameState, GameState } from './GameState';

const DATA_DIR = path.join(__dirname, '..', 'data');
const STATE_FILE = path.join(DATA_DIR, 'gamestate.json');

/**
 * 客户端主导架构：门/地图/玩家都是客户端上报的运行时数据，不持久化。
 * 只持久化「门解锁状态」——客户端重新上报门时合并，重启后仍记得哪些门开过。
 */
export function loadState(target = gameState) {
  if (!fs.existsSync(STATE_FILE)) return;
  try {
    const data = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
    if (data.doorUnlocked && typeof data.doorUnlocked === 'object') {
      for (const [id, unlocked] of Object.entries(data.doorUnlocked)) {
        if (typeof unlocked === 'boolean') {
          target.doorUnlocked[id] = unlocked;
        }
      }
    }
  } catch (err) {
    console.error('[Persistence] Failed to load state:', err);
  }
}

let saveTimeout: NodeJS.Timeout | null = null;

export function saveState(source = gameState) {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(
      STATE_FILE,
      JSON.stringify({ doorUnlocked: source.doorUnlocked }, null, 2)
    );
  }, 300);
}
