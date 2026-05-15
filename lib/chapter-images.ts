import path from 'node:path';
import {promises as fs} from 'node:fs';
import {generateImage} from './cover';
import {OUTPUT_DIR, type Job} from './jobs';

export function chapterImageDir(jobId: string): string {
  return path.join(OUTPUT_DIR, jobId, 'chapters');
}

export function chapterImagePath(jobId: string, index: number): string {
  return path.join(chapterImageDir(jobId), `${index}.jpg`);
}

const FALLBACK_PROMPT = (title: string) =>
  `Cinematic dark editorial illustration symbolizing "${title}", abstract evocative composition, deep navy background with crimson and gold accents, moody dramatic lighting, NO text NO people, vertical 9:16`;

export async function ensureChapterImages(opts: {
  job: Job;
  apiKey: string;
  onProgress?: (done: number, total: number) => void;
}): Promise<void> {
  const {job, apiKey, onProgress} = opts;
  const total = job.config.chapters.length;
  for (let i = 0; i < total; i++) {
    const ch = job.config.chapters[i];
    const p = chapterImagePath(job.id, i);
    let exists = false;
    try {
      await fs.access(p);
      exists = true;
    } catch {
      // 不存在，生
    }
    if (!exists) {
      const prompt = ch.imagePrompt?.trim() || FALLBACK_PROMPT(ch.title);
      await generateImage({apiKey, prompt, outPath: p});
    }
    onProgress?.(i + 1, total);
  }
}
