import {promises as fs} from 'node:fs';
import path from 'node:path';
import {DATA_DIR} from './jobs';

export const CONFIG_DIR = path.join(DATA_DIR, 'config');
export const KEYS_FILE = path.join(CONFIG_DIR, 'api-keys.json');
export const PREFS_FILE = path.join(CONFIG_DIR, 'preferences.json');

export type ApiKeys = {
  minimax?: string;
};

export type Preferences = {
  brand?: string;
  subtitleOffsetSec?: number; // 字幕时间补偿（秒）：正值=字幕延后；负值=字幕提前
};

export const DEFAULT_BRAND = 'podcast.cab';
export const DEFAULT_SUBTITLE_OFFSET = 0.2;

export async function loadKeys(): Promise<ApiKeys> {
  try {
    const raw = await fs.readFile(KEYS_FILE, 'utf-8');
    return JSON.parse(raw) as ApiKeys;
  } catch (err: unknown) {
    if (
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      (err as {code?: string}).code === 'ENOENT'
    ) {
      return {};
    }
    throw err;
  }
}

export async function saveKeys(keys: ApiKeys): Promise<void> {
  await fs.mkdir(CONFIG_DIR, {recursive: true});
  const existing = await loadKeys();
  const merged = {...existing};
  if (keys.minimax !== undefined) {
    if (keys.minimax === '') delete merged.minimax;
    else merged.minimax = keys.minimax;
  }
  await fs.writeFile(KEYS_FILE, JSON.stringify(merged, null, 2), {mode: 0o600});
}

export function maskKey(key?: string): string | null {
  if (!key) return null;
  if (key.length < 10) return '****';
  return `${key.slice(0, 6)}...${key.slice(-4)}`;
}

export async function loadPrefs(): Promise<Preferences> {
  try {
    const raw = await fs.readFile(PREFS_FILE, 'utf-8');
    return JSON.parse(raw) as Preferences;
  } catch (err: unknown) {
    if (
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      (err as {code?: string}).code === 'ENOENT'
    ) {
      return {};
    }
    throw err;
  }
}

export async function savePrefs(prefs: Preferences): Promise<void> {
  await fs.mkdir(CONFIG_DIR, {recursive: true});
  const existing = await loadPrefs();
  const merged = {...existing};
  if (prefs.brand !== undefined) {
    const trimmed = prefs.brand.trim();
    if (trimmed === '') delete merged.brand;
    else merged.brand = trimmed;
  }
  if (prefs.subtitleOffsetSec !== undefined) {
    // clamp 防极端值
    merged.subtitleOffsetSec = Math.max(-2, Math.min(2, Number(prefs.subtitleOffsetSec) || 0));
  }
  await fs.writeFile(PREFS_FILE, JSON.stringify(merged, null, 2));
}

export async function getBrand(): Promise<string> {
  const prefs = await loadPrefs();
  return prefs.brand || DEFAULT_BRAND;
}

export async function getSubtitleOffset(): Promise<number> {
  const prefs = await loadPrefs();
  return prefs.subtitleOffsetSec ?? DEFAULT_SUBTITLE_OFFSET;
}
