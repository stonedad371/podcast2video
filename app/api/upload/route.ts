import {NextRequest, NextResponse} from 'next/server';
import {promises as fs} from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {parseSrt, computeTimeScale, uniqueSpeakers} from '@/lib/parseSrt';
import {getAudioDurationSec} from '@/lib/ffprobe';
import {createJob, UPLOADS_DIR, ensureDirs} from '@/lib/jobs';

export const runtime = 'nodejs';
export const maxDuration = 60;

const AUDIO_EXT = new Set(['mp3', 'wav', 'm4a', 'aac', 'ogg', 'flac']);
const SRT_EXT = new Set(['srt', 'vtt']);

function extOf(name: string): string {
  return (name.split('.').pop() || '').toLowerCase();
}

export async function POST(req: NextRequest) {
  await ensureDirs();

  const form = await req.formData();
  const audio = form.get('audio');
  const srt = form.get('srt');
  const title = (form.get('title') as string | null) || '播客标题';
  const subtitle = (form.get('subtitle') as string | null) || '一句话副标题';

  if (!(audio instanceof File) || !(srt instanceof File)) {
    return NextResponse.json({error: '需要同时上传 audio 和 srt 两个文件'}, {status: 400});
  }

  const audioExt = extOf(audio.name);
  const srtExt = extOf(srt.name);
  if (!AUDIO_EXT.has(audioExt)) {
    return NextResponse.json(
      {error: `不支持的音频格式 .${audioExt}，请用 mp3/wav/m4a/aac/ogg/flac`},
      {status: 400},
    );
  }
  if (!SRT_EXT.has(srtExt)) {
    return NextResponse.json(
      {error: `不支持的字幕格式 .${srtExt}，请用 srt`},
      {status: 400},
    );
  }

  // 落盘
  const id = randomUUID();
  const uploadDir = path.join(UPLOADS_DIR, id);
  await fs.mkdir(uploadDir, {recursive: true});

  const audioPath = path.join(uploadDir, `audio.${audioExt}`);
  const srtPath = path.join(uploadDir, `captions.${srtExt}`);
  await fs.writeFile(audioPath, Buffer.from(await audio.arrayBuffer()));
  await fs.writeFile(srtPath, Buffer.from(await srt.arrayBuffer()));

  // 分析
  let durationSec: number;
  try {
    durationSec = await getAudioDurationSec(audioPath);
  } catch (err) {
    return NextResponse.json(
      {error: `读取音频时长失败：${(err as Error).message}`},
      {status: 500},
    );
  }

  const srtText = await fs.readFile(srtPath, 'utf-8');
  const cues = parseSrt(srtText);
  if (cues.length === 0) {
    return NextResponse.json({error: 'SRT 解析出 0 条字幕，文件格式可能有问题'}, {status: 400});
  }
  const lastCueEndSec = cues[cues.length - 1].endSec;
  const subtitleTimeScale = computeTimeScale(durationSec, cues);
  const speakers = uniqueSpeakers(cues);

  const job = await createJob({
    id,
    audio: {
      filename: audio.name,
      path: audioPath,
      sizeBytes: audio.size,
      durationSec,
    },
    srt: {
      filename: srt.name,
      path: srtPath,
      cueCount: cues.length,
      lastCueEndSec,
      speakers,
    },
    computed: {subtitleTimeScale},
    config: {
      title,
      subtitle,
      accentColor: '#fbbf24',
      chapters: [],
      quotes: [],
    },
  });

  return NextResponse.json({job});
}
