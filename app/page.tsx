'use client';

import {Fragment, useEffect, useRef, useState} from 'react';
import {UploadZone, type UploadResult} from './components/UploadZone';
import {JobSummary} from './components/JobSummary';
import {SettingsModal} from './components/SettingsModal';
import {Preview} from './components/Preview';
import {RenderPanel} from './components/RenderPanel';
import {ChapterImagesPanel, type ChapterImageInfo} from './components/ChapterImagesPanel';
import type {PodcastProps} from '@/remotion/Composition';

type ConfigState = {
  minimax: {configured: boolean; masked: string | null};
  brand: string;
  subtitleOffsetSec: number;
};

export default function Home() {
  const [job, setJob] = useState<UploadResult | null>(null);
  const [fullJob, setFullJob] = useState<FullJob | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [config, setConfig] = useState<ConfigState | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [generatingCover, setGeneratingCover] = useState(false);
  const [renderState, setRenderState] = useState<{
    status: 'queued' | 'bundling' | 'rendering' | 'done' | 'failed';
    stage?: 'images' | 'bundling' | 'rendering';
    progress: number;
    imagesDone?: number;
    imagesTotal?: number;
  } | null>(null);
  const [chapterImages, setChapterImages] = useState<ChapterImageInfo[]>([]);
  const [error, setError] = useState<string | null>(null);

  // 防 strictMode 双跑 / refreshConfig 触发 effect 重跑导致重复 POST analyze + cover
  const processedJobIdRef = useRef<string | null>(null);
  // autoRender 每个 job 只触发一次
  const autoRenderTriggeredRef = useRef<string | null>(null);
  // 章节图 batch 也每 job 只触发一次
  const chapterImagesKickedRef = useRef<string | null>(null);

  const chapterImagesReady =
    chapterImages.length > 0 && chapterImages.every((c) => c.status === 'done');

  const refreshConfig = () =>
    fetch('/api/config')
      .then((r) => r.json())
      .then(setConfig);

  useEffect(() => {
    refreshConfig();
  }, []);

  // 轮询 render 状态供 PipelineProgress 用（RenderPanel 自己也独立轮，互不影响）
  useEffect(() => {
    if (!job) {
      setRenderState(null);
      return;
    }
    let stopped = false;
    const tick = async () => {
      try {
        const data = await fetch(`/api/render/${job.id}/status`).then((r) => r.json());
        if (stopped) return;
        setRenderState(data.render ?? null);
      } catch {
        // 忽略：下次轮询再试
      }
    };
    tick();
    const t = setInterval(tick, 2000);
    return () => {
      stopped = true;
      clearInterval(t);
    };
  }, [job]);

  // 上传完成后自动分析 + 生封面（基于 key 配置）
  // 依赖只看 jobId 和"key 是否配置"——避免 config 对象引用变化（refreshConfig 后）
  // 触发整个 pipeline 重跑（导致重复扣费）。strictMode 双 mount 用 processedJobIdRef 拦截。
  const hasKey = config?.minimax.configured ?? false;
  useEffect(() => {
    if (!job || !config) return;
    if (processedJobIdRef.current === job.id) return;
    processedJobIdRef.current = job.id;

    let cancelled = false;
    const ac = new AbortController();
    const run = async () => {
      setError(null);
      // 先把基础 job 信息显示出来
      try {
        const initial = await fetch(`/api/job/${job.id}`, {signal: ac.signal}).then((r) =>
          r.json(),
        );
        if (cancelled) return;
        setFullJob(initial.job);
      } catch {
        if (cancelled) return;
      }

      if (!hasKey) return;

      setAnalyzing(true);
      let analyzeOk = false;
      try {
        const res = await fetch(`/api/analyze/${job.id}`, {method: 'POST', signal: ac.signal});
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) throw new Error(data.error || '分析失败');
        setFullJob(data.job);
        analyzeOk = true;
      } catch (e) {
        if (cancelled) return;
        // 网络 fetch failed 时后端 analyze 可能已经跑完。重新拉一次 job，
        // 如果已经写好了 chapters 就当成功（避免误报错）。
        try {
          const recheck = await fetch(`/api/job/${job.id}`, {signal: ac.signal}).then((r) =>
            r.json(),
          );
          if (cancelled) return;
          if (recheck.job?.config?.chapters?.length > 0) {
            setFullJob(recheck.job);
            analyzeOk = true;
            setError(null); // 兜底成功时清除之前 fetch 失败的误导提示
          } else {
            setError(`自动分析失败：${(e as Error).message}`);
          }
        } catch {
          if (!cancelled) setError(`自动分析失败：${(e as Error).message}`);
        }
      } finally {
        if (!cancelled) setAnalyzing(false);
      }
      if (cancelled || !analyzeOk) return;

      // 分析成功 → 立即异步触发章节图批量生成（独立轮询监控状态）
      if (chapterImagesKickedRef.current !== job.id) {
        chapterImagesKickedRef.current = job.id;
        fetch(`/api/chapter-images/${job.id}`, {method: 'POST', signal: ac.signal}).catch(() => {
          // 失败不阻塞流程；轮询会显示 failed 状态，用户能点重生
        });
      }

      setGeneratingCover(true);
      try {
        const res = await fetch(`/api/cover/${job.id}`, {method: 'POST', signal: ac.signal});
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) throw new Error(data.error || '生封面失败');
        setFullJob(data.job);
      } catch (e) {
        if (!cancelled) {
          setError((prev) =>
            prev
              ? `${prev}；封面失败：${(e as Error).message}`
              : `封面失败：${(e as Error).message}`,
          );
        }
      } finally {
        if (!cancelled) setGeneratingCover(false);
      }
      // autoRender 不再在这里触发——改由章节图就绪后单独的 effect 决定（见下方）
    };
    run();
    return () => {
      cancelled = true;
      ac.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job?.id, hasKey]);

  // 章节图状态轮询——只要有 job 就轮，2s 一次。任一张状态变化就重渲，UI 自动更新缩略图
  useEffect(() => {
    if (!job) {
      setChapterImages([]);
      return;
    }
    let stopped = false;
    const tick = async () => {
      try {
        const data = await fetch(`/api/chapter-images/${job.id}`).then((r) => r.json());
        if (stopped) return;
        if (Array.isArray(data.chapters)) setChapterImages(data.chapters);
      } catch {
        // 忽略
      }
    };
    tick();
    const t = setInterval(tick, 2000);
    return () => {
      stopped = true;
      clearInterval(t);
    };
  }, [job]);

  // autoRender gate：章节图全部就绪 + autoRender 开 + 本 job 没自动触发过 → POST render
  useEffect(() => {
    if (!job) return;
    if (!chapterImagesReady) return;
    if (autoRenderTriggeredRef.current === job.id) return;
    if (typeof window === 'undefined') return;
    if (localStorage.getItem('autoRender') !== 'true') return;
    autoRenderTriggeredRef.current = job.id;
    fetch(`/api/render/${job.id}`, {method: 'POST'}).catch((e) => {
      setError((prev) =>
        prev
          ? `${prev}；自动渲染启动失败：${(e as Error).message}`
          : `自动渲染启动失败：${(e as Error).message}`,
      );
    });
  }, [job, chapterImagesReady]);

  const reset = () => {
    setJob(null);
    setFullJob(null);
    setChapterImages([]);
    setError(null);
    processedJobIdRef.current = null;
    autoRenderTriggeredRef.current = null;
    chapterImagesKickedRef.current = null;
  };

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '32px 24px 48px',
        gap: 24,
      }}
    >
      {/* 顶部工具栏 */}
      <header
        style={{
          width: '100%',
          maxWidth: 960,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}
      >
        <a
          href="https://podcast.cab"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontSize: 20,
            color: '#fbbf24',
            fontWeight: 800,
            letterSpacing: 1,
            textDecoration: 'none',
            fontFamily: '"SF Mono", Menlo, monospace',
          }}
        >
          podcast.cab
        </a>
        <button
          onClick={() => setSettingsOpen(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 16px',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid #374151',
            borderRadius: 999,
            color: '#cbd5e1',
            cursor: 'pointer',
            fontSize: 13,
          }}
        >
          ⚙️ 设置
          {config && (
            <span style={{color: config.minimax.configured ? '#a7f3d0' : '#9ca3af', fontSize: 11}}>
              {config.minimax.configured ? '已配置' : '未配置'}
            </span>
          )}
        </button>
      </header>

      {!job ? (
        <>
          <h1
            style={{
              fontSize: 56,
              fontWeight: 800,
              lineHeight: 1.15,
              textAlign: 'center',
              maxWidth: 900,
              marginTop: 16,
            }}
          >
            把播客做成可发布的视频
          </h1>
          <p
            style={{
              color: '#9ca3af',
              fontSize: 18,
              textAlign: 'center',
              maxWidth: 720,
              lineHeight: 1.6,
            }}
          >
            上传音频和 SRT 字幕，自动生成带封面、章节卡、金句、进度条的 9:16 短视频。
          </p>

          <UploadZone onUploaded={setJob} />

          <section
            style={{
              maxWidth: 720,
              padding: '16px 24px',
              backgroundColor: 'rgba(251, 191, 36, 0.06)',
              border: '1px solid rgba(251, 191, 36, 0.2)',
              borderRadius: 12,
              textAlign: 'center',
              fontSize: 14,
              color: '#cbd5e1',
              lineHeight: 1.6,
            }}
          >
            没有播客音频和字幕？推荐用{' '}
            <a
              href="https://yuban.yun/?ref=52UM5HD3"
              target="_blank"
              rel="noopener noreferrer"
              style={{color: '#fbbf24', textDecoration: 'underline', fontWeight: 700}}
            >
              yuban.yun
            </a>{' '}
            一键生成播客音频与时间戳字幕。
          </section>
        </>
      ) : (
        <div style={{width: '100%', maxWidth: 960, display: 'flex', flexDirection: 'column', gap: 24}}>
          <PipelineProgress
            hasJob={!!job}
            hasKey={config?.minimax.configured ?? false}
            analyzing={analyzing}
            analyzeDone={
              !!fullJob?.config?.chapters && fullJob.config.chapters.length > 0
            }
            generatingCover={generatingCover}
            coverDone={!!fullJob?.cover}
            render={renderState}
          />

          <JobSummary job={job} hasKey={config?.minimax.configured ?? false} />

          <AnalysisProgress
            analyzing={analyzing}
            generatingCover={generatingCover}
            hasKey={config?.minimax.configured ?? false}
            onOpenSettings={() => setSettingsOpen(true)}
          />

          {fullJob && <ChaptersAndQuotes job={fullJob} />}

          {fullJob?.cover && (
            <CoverPreview job={fullJob} brand={config?.brand ?? 'podcast.cab'} />
          )}

          {fullJob && chapterImages.length > 0 && (
            <ChapterImagesPanel jobId={fullJob.id} chapters={chapterImages} />
          )}

          {fullJob &&
            (() => {
              const previewProps = buildPreviewProps(
                fullJob,
                config?.brand ?? 'podcast.cab',
                config?.subtitleOffsetSec ?? 0.2,
              );
              return previewProps ? <Preview props={previewProps} /> : null;
            })()}

          {fullJob && (
            <RenderPanel
              jobId={fullJob.id}
              canRender={!!fullJob.cover && chapterImagesReady}
              gateReason={
                !fullJob.cover
                  ? '先准备好封面'
                  : !chapterImagesReady
                    ? `等章节图就绪（${chapterImages.filter((c) => c.status === 'done').length} / ${chapterImages.length}）`
                    : undefined
              }
            />
          )}

          {error && (
            <div
              style={{
                padding: '12px 16px',
                backgroundColor: 'rgba(239,68,68,0.1)',
                border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: 10,
                color: '#fca5a5',
                fontSize: 14,
              }}
            >
              ⚠️ {error}
            </div>
          )}

          <button
            onClick={reset}
            style={{
              padding: '10px 20px',
              background: 'transparent',
              border: '1px solid #374151',
              borderRadius: 10,
              color: '#9ca3af',
              cursor: 'pointer',
              fontSize: 14,
              alignSelf: 'flex-start',
            }}
          >
            ← 上传新文件
          </button>
        </div>
      )}

      <footer
        style={{
          marginTop: 'auto',
          paddingTop: 48,
          color: '#6b7280',
          fontSize: 14,
          textAlign: 'center',
          letterSpacing: 1,
        }}
      >
        <div>
          <a
            href="https://podcast.cab"
            target="_blank"
            rel="noopener noreferrer"
            style={{color: '#fbbf24', fontWeight: 700, fontFamily: '"SF Mono", Menlo, monospace'}}
          >
            podcast.cab
          </a>{' '}
          · 技术支持：
          <a
            href="https://yuban.yun/?ref=52UM5HD3"
            target="_blank"
            rel="noopener noreferrer"
            style={{color: '#fbbf24', fontWeight: 600}}
          >
            yuban.yun
          </a>
        </div>
      </footer>

      <SettingsModal
        open={settingsOpen}
        onClose={() => {
          setSettingsOpen(false);
          refreshConfig();
        }}
      />
    </main>
  );
}

type FullJob = {
  id: string;
  audio: {filename: string; durationSec: number};
  srt: {filename: string; speakers: string[]};
  computed: {subtitleTimeScale: number};
  config: {
    title: string;
    subtitle: string;
    accentColor: string;
    chapters: {atSec: number; title: string; imagePrompt?: string}[];
    quotes: {fromSec: number; durationSec: number; text: string}[];
  };
  cover?: {path: string; sizeBytes: number};
};

function buildPreviewProps(
  job: FullJob,
  brand: string,
  subtitleOffsetSec: number,
): PodcastProps | null {
  if (!job.cover) return null;
  const audioExt = job.audio.filename.split('.').pop() || 'mp3';
  const srtExt = job.srt.filename.split('.').pop() || 'srt';
  const speakers: PodcastProps['speakers'] = {};
  // 默认 主持/嘉宾 双人配色
  const palette = ['#38bdf8', '#fbbf24', '#a855f7', '#4ade80'];
  job.srt.speakers.forEach((sp, i) => {
    speakers[sp] = {
      label: sp,
      color: palette[i % palette.length],
      align: i === 0 ? 'left' : 'right',
    };
  });
  return {
    audioSrc: `/api/files/${job.id}/audio.${audioExt}`,
    srtSrc: `/api/files/${job.id}/captions.${srtExt}`,
    coverSrc: `/api/cover/${job.id}/image`,
    title: job.config.title,
    subtitle: job.config.subtitle,
    brand,
    accentColor: job.config.accentColor || '#fbbf24',
    speakers,
    // 用户在设置里可调；从 config 透传过来
    subtitleOffsetSec,
    // 线性拉伸让 SRT 末尾对齐音频末尾
    subtitleTimeScale: job.computed.subtitleTimeScale,
    chapters: job.config.chapters,
    chapterImageSrcs: job.config.chapters.map(
      (_, i) => `/api/chapter-images/${job.id}/${i}/image`,
    ),
    quotes: job.config.quotes.map((q) => ({
      ...q,
      fromSec: q.fromSec * job.computed.subtitleTimeScale,
      durationSec: q.durationSec * job.computed.subtitleTimeScale,
    })),
    posterDurationSec: 0.6,
    outroDurationSec: 5,
    audioDurationSec: job.audio.durationSec,
  };
}

function AnalysisProgress({
  analyzing,
  generatingCover,
  hasKey,
  onOpenSettings,
}: {
  analyzing: boolean;
  generatingCover: boolean;
  hasKey: boolean;
  onOpenSettings: () => void;
}) {
  if (!hasKey) {
    return (
      <div
        style={{
          padding: 20,
          background: 'rgba(239,68,68,0.06)',
          border: '1px solid rgba(239,68,68,0.25)',
          borderRadius: 12,
          color: '#fca5a5',
          fontSize: 14,
          textAlign: 'center',
        }}
      >
        没配 MiniMax API key，自动章节 / 金句 / 封面都跳过了。{' '}
        <button
          onClick={onOpenSettings}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#fbbf24',
            cursor: 'pointer',
            textDecoration: 'underline',
            fontSize: 14,
          }}
        >
          去配置
        </button>
      </div>
    );
  }
  if (!analyzing && !generatingCover) return null;
  return (
    <div
      style={{
        padding: 16,
        background: 'rgba(251,191,36,0.08)',
        border: '1px solid rgba(251,191,36,0.3)',
        borderRadius: 12,
        color: '#fde68a',
        fontSize: 14,
        display: 'flex',
        gap: 16,
        alignItems: 'center',
      }}
    >
      <span
        style={{
          width: 20,
          height: 20,
          border: '3px solid rgba(251,191,36,0.25)',
          borderTopColor: '#fbbf24',
          borderRadius: '50%',
          animation: 'spin 0.9s linear infinite',
          flexShrink: 0,
        }}
      />
      <div style={{display: 'flex', flexDirection: 'column', gap: 4}}>
        {analyzing && (
          <div>
            🤖 LLM 分析中：切章节 + 挑金句…
            <span style={{color: '#9ca3af', fontSize: 12, marginLeft: 8}}>
              通常 15-40 秒，请耐心等
            </span>
          </div>
        )}
        {generatingCover && (
          <div>
            🎨 LLM 生成封面中…
            <span style={{color: '#9ca3af', fontSize: 12, marginLeft: 8}}>
              约 15-30 秒
            </span>
          </div>
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function ChaptersAndQuotes({job}: {job: FullJob}) {
  const {chapters, quotes} = job.config;
  if (chapters.length === 0 && quotes.length === 0) return null;
  return (
    <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16}}>
      <Panel title={`章节 (${chapters.length})`}>
        {chapters.length > 0 ? (
          chapters.map((c, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                gap: 12,
                padding: '10px 0',
                borderBottom: '1px solid #1f2937',
                fontSize: 14,
              }}
            >
              <span
                style={{
                  color: '#fbbf24',
                  fontFamily: 'monospace',
                  fontWeight: 700,
                  minWidth: 70,
                }}
              >
                {fmt(c.atSec)}
              </span>
              <span style={{color: '#e5e7eb', flex: 1}}>{c.title}</span>
            </div>
          ))
        ) : (
          <div style={{color: '#6b7280', fontSize: 13}}>暂无章节</div>
        )}
      </Panel>
      <Panel title={`金句 (${quotes.length})`}>
        {quotes.length > 0 ? (
          quotes.map((q, i) => (
            <div
              key={i}
              style={{
                padding: '10px 0',
                borderBottom: '1px solid #1f2937',
                fontSize: 13,
              }}
            >
              <div
                style={{
                  color: '#fbbf24',
                  fontFamily: 'monospace',
                  fontSize: 12,
                  marginBottom: 4,
                }}
              >
                {fmt(q.fromSec)} · {q.durationSec.toFixed(1)}s
              </div>
              <div style={{color: '#e5e7eb', whiteSpace: 'pre-wrap'}}>{q.text}</div>
            </div>
          ))
        ) : (
          <div style={{color: '#6b7280', fontSize: 13}}>暂无金句</div>
        )}
      </Panel>
    </div>
  );
}

type StepStatus = 'pending' | 'active' | 'done' | 'failed';

function PipelineProgress({
  hasJob,
  hasKey,
  analyzing,
  analyzeDone,
  generatingCover,
  coverDone,
  render,
}: {
  hasJob: boolean;
  hasKey: boolean;
  analyzing: boolean;
  analyzeDone: boolean;
  generatingCover: boolean;
  coverDone: boolean;
  render: {
    status: 'queued' | 'bundling' | 'rendering' | 'done' | 'failed';
    stage?: 'images' | 'bundling' | 'rendering';
    progress: number;
    imagesDone?: number;
    imagesTotal?: number;
  } | null;
}) {
  const uploadStatus: StepStatus = hasJob ? 'done' : 'active';
  const analyzeStatus: StepStatus = !hasJob
    ? 'pending'
    : !hasKey
      ? 'pending'
      : analyzing
        ? 'active'
        : analyzeDone
          ? 'done'
          : 'pending';
  const coverStatus: StepStatus = !analyzeDone
    ? 'pending'
    : generatingCover
      ? 'active'
      : coverDone
        ? 'done'
        : 'pending';

  let renderStatus: StepStatus = 'pending';
  let renderLabel = '渲染视频';
  if (render) {
    if (render.status === 'done') {
      renderStatus = 'done';
    } else if (render.status === 'failed') {
      renderStatus = 'failed';
      renderLabel = '渲染失败';
    } else {
      renderStatus = 'active';
      if (render.stage === 'images' && render.imagesTotal) {
        renderLabel = `章节图 ${render.imagesDone ?? 0}/${render.imagesTotal}`;
      } else if (render.stage === 'bundling' || render.status === 'bundling') {
        renderLabel = '打包代码';
      } else if (render.stage === 'rendering' || render.status === 'rendering') {
        renderLabel = `渲染 ${Math.round(render.progress * 100)}%`;
      }
    }
  } else if (coverDone) {
    renderLabel = '等待触发';
  }

  const steps = [
    {label: '上传', status: uploadStatus},
    {label: '分析', status: analyzeStatus},
    {label: '封面', status: coverStatus},
    {label: renderLabel, status: renderStatus},
  ];

  return (
    <div
      style={{
        position: 'sticky',
        top: 12,
        zIndex: 30,
        padding: '16px 24px',
        background: 'rgba(15, 18, 25, 0.92)',
        backdropFilter: 'blur(12px)',
        border: '1px solid #1f2937',
        borderRadius: 12,
        boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}
    >
      {steps.map((s, i) => (
        <Fragment key={s.label}>
          <StepDot index={i + 1} label={s.label} status={s.status} />
          {i < steps.length - 1 && (
            <div
              style={{
                flex: 1,
                height: 2,
                background:
                  steps[i].status === 'done'
                    ? 'linear-gradient(90deg, #4ade80, #22c55e)'
                    : 'rgba(255,255,255,0.08)',
                borderRadius: 2,
              }}
            />
          )}
        </Fragment>
      ))}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function StepDot({index, label, status}: {index: number; label: string; status: StepStatus}) {
  const colors = {
    pending: {bg: 'rgba(255,255,255,0.06)', border: '#374151', fg: '#6b7280'},
    active: {bg: 'rgba(251,191,36,0.18)', border: '#fbbf24', fg: '#fbbf24'},
    done: {bg: 'rgba(74,222,128,0.18)', border: '#4ade80', fg: '#a7f3d0'},
    failed: {bg: 'rgba(239,68,68,0.18)', border: '#f87171', fg: '#fca5a5'},
  }[status];
  const symbol = status === 'done' ? '✓' : status === 'failed' ? '✗' : index;
  return (
    <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, minWidth: 0}}>
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: '50%',
          background: colors.bg,
          border: `2px solid ${colors.border}`,
          color: colors.fg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 800,
          fontSize: 14,
          position: 'relative',
          flexShrink: 0,
        }}
      >
        {status === 'active' ? (
          <span
            style={{
              width: 18,
              height: 18,
              border: '2px solid rgba(251,191,36,0.3)',
              borderTopColor: '#fbbf24',
              borderRadius: '50%',
              animation: 'spin 0.9s linear infinite',
            }}
          />
        ) : (
          symbol
        )}
      </div>
      <div
        style={{
          color: colors.fg,
          fontSize: 12,
          fontWeight: 600,
          whiteSpace: 'nowrap',
          textAlign: 'center',
        }}
      >
        {label}
      </div>
    </div>
  );
}

function CoverPreview({job, brand}: {job: FullJob; brand: string}) {
  const accentColor = job.config.accentColor || '#fbbf24';
  const title = job.config.title || '播客标题';
  const subtitle = job.config.subtitle || '';
  // 用 cover.sizeBytes 当版本号——cover 重新生成才会变。避免每次重渲都重拉。
  const coverSrc = `/api/cover/${job.id}/image?v=${job.cover?.sizeBytes ?? 0}`;

  // 模拟视频第一帧（VPoster 的迷你版本）：1080x1920 → 220x391，等比 ≈ 1:4.9
  return (
    <Panel title="AI 生成封面（视频第一帧预览）">
      <div style={{display: 'flex', gap: 20, alignItems: 'flex-start'}}>
        <div
          style={{
            position: 'relative',
            width: 220,
            height: 391,
            borderRadius: 12,
            overflow: 'hidden',
            border: '1px solid #374151',
            background: '#06090f',
            flexShrink: 0,
          }}
        >
          <img
            src={coverSrc}
            alt="cover"
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              opacity: 0.85,
            }}
          />
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background:
                'linear-gradient(180deg, rgba(6,9,15,0.4) 0%, rgba(6,9,15,0.15) 35%, rgba(6,9,15,0.55) 65%, rgba(6,9,15,0.95) 100%)',
            }}
          />
          {/* 顶栏 ● REC / brand —— 对应 VPoster top=110 */}
          <div
            style={{
              position: 'absolute',
              top: 22,
              left: 12,
              right: 12,
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 7,
              letterSpacing: 1.5,
              fontFamily: '"SF Mono", Menlo, monospace',
              textTransform: 'uppercase',
            }}
          >
            <span style={{color: '#f87171'}}>● REC</span>
            <span style={{color: accentColor, fontWeight: 700}}>{brand}</span>
          </div>
          {/* 中间标题 / 副标题 */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              padding: '0 14px',
              fontFamily: 'system-ui, -apple-system, "PingFang SC", sans-serif',
            }}
          >
            <div
              style={{
                color: accentColor,
                fontSize: 8,
                letterSpacing: 1.5,
                fontWeight: 800,
                marginBottom: 8,
                fontFamily: '"SF Mono", Menlo, monospace',
              }}
            >
              {brand}
            </div>
            <div
              style={{
                color: '#fff',
                fontSize: 26,
                fontWeight: 800,
                lineHeight: 1.1,
                textAlign: 'center',
                textShadow: '0 2px 12px rgba(0,0,0,0.75)',
                display: '-webkit-box',
                WebkitLineClamp: 3,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {title}
            </div>
            {subtitle && (
              <div
                style={{
                  color: '#e5e7eb',
                  fontSize: 11,
                  marginTop: 8,
                  letterSpacing: 1,
                  textAlign: 'center',
                  textShadow: '0 1px 6px rgba(0,0,0,0.7)',
                }}
              >
                {subtitle}
              </div>
            )}
            <div
              style={{
                width: 36,
                height: 2,
                backgroundColor: accentColor,
                marginTop: 12,
                boxShadow: `0 0 8px ${accentColor}`,
              }}
            />
          </div>
        </div>
        <div style={{flex: 1, color: '#9ca3af', fontSize: 13, lineHeight: 1.6}}>
          视频第一帧预览：标题 / 副标题 / 品牌都会叠在这张 AI 图上。
          <br />
          <br />
          想改标题或副标题：在上传时填，或留空让 LLM 自动生成。
          <br />
          想改品牌：右上角 ⚙️ 设置。
        </div>
      </div>
    </Panel>
  );
}

function Panel({title, children}: {title: string; children: React.ReactNode}) {
  return (
    <div
      style={{
        padding: 20,
        background: 'rgba(255,255,255,0.025)',
        border: '1px solid #1f2937',
        borderRadius: 12,
      }}
    >
      <div
        style={{
          color: '#cbd5e1',
          fontSize: 14,
          fontWeight: 700,
          marginBottom: 12,
          letterSpacing: 2,
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

function fmt(sec: number) {
  const s = Math.floor(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
