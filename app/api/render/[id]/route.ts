import {NextRequest, NextResponse} from 'next/server';
import path from 'node:path';
import {promises as fs} from 'node:fs';
import {getJob, updateJob, OUTPUT_DIR, ensureDirs} from '@/lib/jobs';
import {renderVideo} from '@/lib/render';
import type {PodcastProps} from '@/remotion/Composition';

export const runtime = 'nodejs';
export const maxDuration = 600;

function buildProps(job: Awaited<ReturnType<typeof getJob>>, baseUrl: string): PodcastProps {
  if (!job) throw new Error('no job');
  if (!job.cover) throw new Error('封面图还没生成，请先在主页生成封面');
  const audioExt = path.extname(job.audio.path).slice(1) || 'mp3';
  const srtExt = path.extname(job.srt.path).slice(1) || 'srt';
  const speakers: PodcastProps['speakers'] = {};
  const palette = ['#38bdf8', '#fbbf24', '#a855f7', '#4ade80'];
  job.srt.speakers.forEach((sp, i) => {
    speakers[sp] = {
      label: sp,
      color: palette[i % palette.length],
      align: i === 0 ? 'left' : 'right',
    };
  });
  return {
    audioSrc: `${baseUrl}/api/files/${job.id}/audio.${audioExt}`,
    srtSrc: `${baseUrl}/api/files/${job.id}/captions.${srtExt}`,
    coverSrc: `${baseUrl}/api/cover/${job.id}/image`,
    title: job.config.title,
    subtitle: job.config.subtitle,
    accentColor: job.config.accentColor || '#fbbf24',
    speakers,
    subtitleOffsetSec: 0,
    subtitleTimeScale: job.computed.subtitleTimeScale,
    chapters: job.config.chapters,
    quotes: job.config.quotes,
    posterDurationSec: 1.0,
    introDurationSec: 5,
    outroDurationSec: 5,
    audioDurationSec: job.audio.durationSec,
  };
}

export async function POST(req: NextRequest, {params}: {params: Promise<{id: string}>}) {
  const {id} = await params;
  const job = await getJob(id);
  if (!job) return NextResponse.json({error: 'job not found'}, {status: 404});
  if (job.render?.status === 'rendering' || job.render?.status === 'queued' || job.render?.status === 'bundling') {
    return NextResponse.json({error: '渲染已在进行中'}, {status: 409});
  }

  // 渲染需要从 Chromium 访问 Next 服务，所以要拿到完整 origin
  const origin = req.headers.get('origin') || req.nextUrl.origin;

  await ensureDirs();
  const outDir = path.join(OUTPUT_DIR, id);
  await fs.mkdir(outDir, {recursive: true});
  const outputPath = path.join(outDir, 'video.mp4');

  let inputProps: PodcastProps;
  try {
    inputProps = buildProps(job, origin);
  } catch (err) {
    return NextResponse.json({error: (err as Error).message}, {status: 400});
  }

  await updateJob(id, {
    render: {
      status: 'queued',
      progress: 0,
      startedAt: Date.now(),
    },
  });

  // 后台跑（不阻塞响应）
  void (async () => {
    try {
      await updateJob(id, {
        render: {
          status: 'bundling',
          stage: 'bundling',
          progress: 0,
          startedAt: Date.now(),
        },
      });
      await renderVideo({
        inputProps,
        outputPath,
        onProgress: async (stage, progress) => {
          const j = await getJob(id);
          if (!j) return;
          await updateJob(id, {
            render: {
              ...(j.render ?? {startedAt: Date.now(), status: 'rendering' as const, progress: 0}),
              status: stage === 'bundling' ? 'bundling' : 'rendering',
              stage,
              progress,
            },
          });
        },
      });
      const stat = await fs.stat(outputPath);
      await updateJob(id, {
        output: {path: outputPath, sizeBytes: stat.size},
        render: {
          status: 'done',
          progress: 1,
          stage: 'rendering',
          startedAt: job.render?.startedAt ?? Date.now(),
          completedAt: Date.now(),
        },
      });
    } catch (err) {
      await updateJob(id, {
        render: {
          status: 'failed',
          progress: 0,
          startedAt: job.render?.startedAt ?? Date.now(),
          completedAt: Date.now(),
          error: (err as Error).message,
        },
      });
    }
  })();

  return NextResponse.json({ok: true, jobId: id});
}
