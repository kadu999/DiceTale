import fs from 'fs';
import path from 'path';
import { gameState, GameState } from './GameState';
import { GameStateSnapshot } from './types';

const DATA_DIR = path.join(__dirname, '..', 'data');
const STATE_FILE = path.join(DATA_DIR, 'gamestate.json');

export function loadState(target = gameState) {
  if (!fs.existsSync(STATE_FILE)) return;
  try {
    const data = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8')) as Partial<GameStateSnapshot>;
    if (data.currentMap) target.currentMap = data.currentMap;
    if (data.player?.position) target.player.position = data.player.position;
    if (data.doors) {
      for (const [id, door] of Object.entries(data.doors)) {
        target.doors[id] = { ...door };
      }
    }
    if (data.spawnPoints) {
      target.spawnPoints = JSON.parse(JSON.stringify(data.spawnPoints));
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
    fs.writeFileSync(STATE_FILE, JSON.stringify(source.getSnapshot(), null, 2));
  }, 300);
}
