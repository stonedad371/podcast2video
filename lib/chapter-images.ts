import path from 'node:path';
import {promises as fs} from 'node:fs';
import {generateImage} from './cover';
import {regenerateImagePrompt} from './chapter-prompt';
import {parseSrt} from './parseSrt';
import {OUTPUT_DIR, getJob, updateJob, type Job, type Chapter} from './jobs';

export function chapterImageDir(jobId: string): string {
  return path.join(OUTPUT_DIR, jobId, 'chapters');
}

export function chapterImagePath(jobId: string, index: number): string {
  return path.join(chapterImageDir(jobId), `${index}.jpg`);
}

const FALLBACK_PROMPT = (title: string) =>
  `Cinematic dark editorial illustration symbolizing "${title}", abstract evocative composition, deep navy background with crimson and gold accents, moody dramatic lighting, NO text NO people, vertical 9:16`;

// 从字幕里截取属于这一章的文本节选（前 2000 字符），供 LLM 综合时参考
async function getChapterCues(job: Job, index: number): Promise<string> {
  try {
    const srtText = await fs.readFile(job.srt.path, 'utf-8');
    const cues = parseSrt(srtText);
    const chapters = job.config.chapters;
    const start = chapters[index].atSec;
    const end = index < chapters.length - 1 ? chapters[index + 1].atSec : Infinity;
    return cues
      .filter((c) => c.startSec >= start && c.startSec < end)
      .map((c) => c.text)
      .join('\n');
  } catch {
    return '';
  }
}

async function patchChapter(jobId: string, index: number, patch: Partial<Chapter>): Promise<void> {
  await updateJob(jobId, (j) => {
    const chapters = [...j.config.chapters];
    if (!chapters[index]) return null;
    chapters[index] = {...chapters[index], ...patch};
    return {config: {...j.config, chapters}};
  });
}

// 生成单张章节图——既被 ensureChapterImages 批量调，也被单张 API 调
// regenerate=true 时：调 LLM 综合产新 prompt（用 currentPrompt + hint + cuesText）再写图
// regenerate=false 时：直接用 chapter.imagePrompt（首次生成场景）
export async function generateOneChapterImage(opts: {
  jobId: string;
  index: number;
  apiKey: string;
  regenerate?: boolean;
  hint?: string;
}): Promise<void> {
  const {jobId, index, apiKey, regenerate, hint} = opts;
  await patchChapter(jobId, index, {imageStatus: 'generating', imageError: undefined});

  try {
    let prompt: string;
    if (regenerate) {
      const job = await getJob(jobId);
      if (!job) throw new Error('job 消失了');
      const ch = job.config.chapters[index];
      if (!ch) throw new Error('章节越界');
      const cuesText = await getChapterCues(job, index);
      prompt = await regenerateImagePrompt({
        apiKey,
        chapterTitle: ch.title,
        cuesText,
        currentPrompt: ch.imagePrompt,
        userHint: hint,
      });
      // 把新 prompt + hint 持久化到 chapter，下次重生能看到上次用了什么
      await patchChapter(jobId, index, {imagePrompt: prompt, imageHint: hint?.trim() || undefined});
    } else {
      const job = await getJob(jobId);
      if (!job) throw new Error('job 消失了');
      const ch = job.config.chapters[index];
      if (!ch) throw new Error('章节越界');
      prompt = ch.imagePrompt?.trim() || FALLBACK_PROMPT(ch.title);
    }

    const outPath = chapterImagePath(jobId, index);
    await generateImage({apiKey, prompt, outPath});
    await patchChapter(jobId, index, {imageStatus: 'done'});
  } catch (err) {
    await patchChapter(jobId, index, {
      imageStatus: 'failed',
      imageError: (err as Error).message,
    });
    throw err;
  }
}

// 批量：把所有 imageStatus !== 'done' 的章节都生一遍（已存在文件 + status 还没设的也会过一遍）
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
    let fileExists = false;
    try {
      await fs.access(p);
      fileExists = true;
    } catch {
      // 不存在
    }
    if (ch.imageStatus === 'done' && fileExists) {
      onProgress?.(i + 1, total);
      continue;
    }
    await generateOneChapterImage({jobId: job.id, index: i, apiKey, regenerate: false});
    onProgress?.(i + 1, total);
  }
}
