import {NextRequest} from 'next/server';
import path from 'node:path';
import {jobUploadDir, getJob} from '@/lib/jobs';
import {streamFileResponse} from '@/lib/http-stream';

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
  req: NextRequest,
  {params}: {params: Promise<{id: string; name: string}>},
) {
  const {id, name} = await params;
  const job = await getJob(id);
  if (!job) return new Response('job not found', {status: 404});

  // 仅允许任务上传目录里的文件，防目录穿越
  const safe = path.basename(name);
  const fullPath = path.join(jobUploadDir(id), safe);
  const ext = (safe.split('.').pop() || '').toLowerCase();

  return streamFileResponse({
    filePath: fullPath,
    contentType: MIME[ext] || 'application/octet-stream',
    rangeHeader: req.headers.get('range'),
    extraHeaders: {
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
