import {randomUUID} from 'node:crypto';
import {promises as fs} from 'node:fs';
import path from 'node:path';

export const DATA_DIR = process.env.DATA_DIR || '/data';
export const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
export const OUTPUT_DIR = path.join(DATA_DIR, 'output');
export const JOBS_FILE = path.join(DATA_DIR, 'jobs.json');

export type JobStatus = 'analyzed' | 'rendering' | 'done' | 'failed';

export type Chapter = {atSec: number; title: string};
export type Quote = {fromSec: number; durationSec: number; text: string};

export type Job = {
  id: string;
  createdAt: number;
  status: JobStatus;
  audio: {filename: string; path: string; sizeBytes: number; durationSec: number};
  srt: {filename: string; path: string; cueCount: number; lastCueEndSec: number; speakers: string[]};
  computed: {subtitleTimeScale: number};
  config: {
    title: string;
    subtitle: string;
    accentColor: string;
    chapters: Chapter[];
    quotes: Quote[];
  };
  cover?: {path: string; sizeBytes: number};
  output?: {path: string; sizeBytes: number};
  render?: {
    status: 'queued' | 'bundling' | 'rendering' | 'done' | 'failed';
    progress: number;
    stage?: 'bundling' | 'rendering';
    startedAt: number;
    completedAt?: number;
    error?: string;
  };
  error?: string;
};

export async function ensureDirs() {
  await fs.mkdir(UPLOADS_DIR, {recursive: true});
  await fs.mkdir(OUTPUT_DIR, {recursive: true});
}

async function readAll(): Promise<Record<string, Job>> {
  try {
    const raw = await fs.readFile(JOBS_FILE, 'utf-8');
    return JSON.parse(raw) as Record<string, Job>;
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

async function writeAll(data: Record<string, Job>) {
  await ensureDirs();
  await fs.writeFile(JOBS_FILE, JSON.stringify(data, null, 2));
}

export async function createJob(
  partial: Omit<Job, 'id' | 'createdAt' | 'status'> & {id?: string},
): Promise<Job> {
  const job: Job = {
    id: partial.id ?? randomUUID(),
    createdAt: Date.now(),
    status: 'analyzed',
    ...partial,
  };
  const all = await readAll();
  all[job.id] = job;
  await writeAll(all);
  return job;
}

export async function getJob(id: string): Promise<Job | null> {
  const all = await readAll();
  return all[id] ?? null;
}

export async function updateJob(id: string, patch: Partial<Job>): Promise<Job | null> {
  const all = await readAll();
  if (!all[id]) return null;
  all[id] = {...all[id], ...patch};
  await writeAll(all);
  return all[id];
}

export async function listJobs(): Promise<Job[]> {
  const all = await readAll();
  return Object.values(all).sort((a, b) => b.createdAt - a.createdAt);
}

export function jobUploadDir(id: string): string {
  return path.join(UPLOADS_DIR, id);
}
