import {NextRequest, NextResponse} from 'next/server';
import path from 'node:path';
import {promises as fs} from 'node:fs';
import {getJob, updateJob, OUTPUT_DIR, ensureDirs} from '@/lib/jobs';
import {renderVideo} from '@/lib/render';
import {ensureChapterImages} from '@/lib/chapter-images';
import {loadKeys, getBrand} from '@/lib/config';
import type {PodcastProps} from '@/remotion/Composition';

export const runtime = 'nodejs';
export const maxDuration = 600;

function buildProps(
  job: Awaited<ReturnType<typeof getJob>>,
  baseUrl: string,
  brand: string,
): PodcastProps {
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
    brand,
    accentColor: job.config.accentColor || '#fbbf24',
    speakers,
    subtitleOffsetSec: 0,
    subtitleTimeScale: job.computed.subtitleTimeScale,
    hook: job.config.hook ?? {number: '', text: ''},
    chapters: job.config.chapters,
    quotes: job.config.quotes,
    chapterImageSrcs: job.config.chapters.map(
      (_, i) => `${baseUrl}/api/chapter-images/${job.id}/${i}/image`,
    ),
    hookDurationSec: job.config.hook ? 3 : 0,
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

  // Chromium 在 Remotion bundle 里 fetch 字幕/音频/封面。Docker 容器里 localhost:3010
  // （宿主机映射端口）从容器内访问不到，必须走容器内自己监听的 PORT。
  // 本地 dev 模式下 PORT 默认 3000，跟浏览器开的端口一致，也成立。
  const port = process.env.PORT || '3000';
  const origin = `http://127.0.0.1:${port}`;

  await ensureDirs();
  const outDir = path.join(OUTPUT_DIR, id);
  await fs.mkdir(outDir, {recursive: true});
  const outputPath = path.join(outDir, 'video.mp4');

  const brand = await getBrand();
  let inputProps: PodcastProps;
  try {
    inputProps = buildProps(job, origin, brand);
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
      // 先生成所有章节图：缺图时 Chromium 会死循环 retry 卡住整个 render，
      // 所以这一步**必须**成功（或者整个 render 直接失败给用户明确反馈）。
      const keys = await loadKeys();
      const chapterCount = job.config.chapters.length;
      if (keys.minimax && chapterCount > 0) {
        await updateJob(id, {
          render: {
            status: 'bundling',
            stage: 'images',
            progress: 0,
            startedAt: Date.now(),
          },
        });
        await ensureChapterImages({
          job,
          apiKey: keys.minimax,
          onProgress: async (done, total) => {
            await updateJob(id, {
              render: {
                status: 'bundling',
                stage: 'images',
                progress: done / total,
                imagesDone: done,
                imagesTotal: total,
                startedAt: Date.now(),
              },
            });
          },
        });
      }

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
          // Remotion 不 await onProgress；最后一次 progress=1 回调可能晚于下面 status='done'
          // 那一步执行。guard 必须在 serialize 内基于最新磁盘状态做，否则 stale 读会失效。
          await updateJob(id, (j) => {
            if (j.render?.status === 'done' || j.render?.status === 'failed') return null;
            return {
              render: {
                ...(j.render ?? {startedAt: Date.now(), status: 'rendering' as const, progress: 0}),
                status: stage === 'bundling' ? 'bundling' : 'rendering',
                stage,
                progress,
              },
            };
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
