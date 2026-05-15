import {NextRequest} from 'next/server';
import {promises as fs} from 'node:fs';
import path from 'node:path';
import {jobUploadDir, getJob} from '@/lib/jobs';

export const runtime = 'nodejs';

const MIME: Record<string, string> = {
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  ogg: 'audio/ogg',
  flac: 'audio/flac',
  srt: 'text/plain; charset=utf-8',
  vtt: 'text/vtt; charset=utf-8',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

export async function GET(
  _req: NextRequest,
  {params}: {params: Promise<{id: string; name: string}>},
) {
  const {id, name} = await params;
  const job = await getJob(id);
  if (!job) return new Response('job not found', {status: 404});

  // 仅允许任务上传目录里的文件，防目录穿越
  const safe = path.basename(name);
  const fullPath = path.join(jobUploadDir(id), safe);

  try {
    const data = await fs.readFile(fullPath);
    const ext = (safe.split('.').pop() || '').toLowerCase();
    return new Response(new Uint8Array(data), {
      headers: {
        'Content-Type': MIME[ext] || 'application/octet-stream',
        'Cache-Control': 'no-store',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch {
    return new Response('not found', {status: 404});
  }
}
