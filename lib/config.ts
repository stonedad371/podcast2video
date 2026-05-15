import {promises as fs} from 'node:fs';
import path from 'node:path';
import {DATA_DIR} from './jobs';

export const CONFIG_DIR = path.join(DATA_DIR, 'config');
export const KEYS_FILE = path.join(CONFIG_DIR, 'api-keys.json');

export type ApiKeys = {
  minimax?: string;
};

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
