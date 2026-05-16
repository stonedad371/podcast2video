'use client';

import {Fragment, useState} from 'react';

export type ChapterImageStatus = 'pending' | 'generating' | 'done' | 'failed';

export type ChapterImageInfo = {
  index: number;
  title: string;
  status: ChapterImageStatus;
  hint: string;
  prompt: string;
  error?: string;
};

export function ChapterImagesPanel({
  jobId,
  chapters,
  onRegenerated,
}: {
  jobId: string;
  chapters: ChapterImageInfo[];
  onRegenerated?: () => void;
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [hintDraft, setHintDraft] = useState('');
  const [busy, setBusy] = useState(false);

  if (chapters.length === 0) return null;

  const submitRegenerate = async (index: number) => {
    setBusy(true);
    try {
      await fetch(`/api/chapter-images/${jobId}/${index}`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({hint: hintDraft.trim() || undefined}),
      });
      setOpenIndex(null);
      setHintDraft('');
      onRegenerated?.();
    } finally {
      setBusy(false);
    }
  };

  const openEditor = (ch: ChapterImageInfo) => {
    setOpenIndex(ch.index);
    setHintDraft(ch.hint || '');
  };

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
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          marginBottom: 16,
        }}
      >
        <div style={{color: '#cbd5e1', fontSize: 14, fontWeight: 700, letterSpacing: 2}}>
          章节背景图（{chapters.filter((c) => c.status === 'done').length} / {chapters.length} 已就绪）
        </div>
        <div style={{color: '#6b7280', fontSize: 12}}>
          不满意可点 🔄 重生，用提示词指引 AI
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${Math.min(chapters.length, 5)}, 1fr)`,
          gap: 12,
        }}
      >
        {chapters.map((ch) => (
          <Thumb key={ch.index} jobId={jobId} chapter={ch} onClickRegen={() => openEditor(ch)} />
        ))}
      </div>

      {openIndex !== null && (
        <div
          style={{
            marginTop: 16,
            padding: 16,
            background: 'rgba(251,191,36,0.06)',
            border: '1px solid rgba(251,191,36,0.3)',
            borderRadius: 10,
          }}
        >
          <div style={{color: '#fde68a', fontSize: 13, marginBottom: 10, fontWeight: 600}}>
            重新生成「{chapters.find((c) => c.index === openIndex)?.title}」的背景图
          </div>
          <textarea
            value={hintDraft}
            onChange={(e) => setHintDraft(e.target.value)}
            placeholder="给 AI 一句提示（可空）：&#10;例：画得更暗一点 / 用瀑布隐喻 / 加点雾气&#10;留空则只让 LLM 重新综合一次"
            rows={3}
            style={{
              width: '100%',
              padding: 12,
              background: 'rgba(0,0,0,0.3)',
              border: '1px solid #374151',
              borderRadius: 8,
              color: '#e5e7eb',
              fontSize: 13,
              fontFamily: 'inherit',
              resize: 'vertical',
            }}
          />
          <div style={{display: 'flex', gap: 8, marginTop: 10, justifyContent: 'flex-end'}}>
            <button
              onClick={() => {
                setOpenIndex(null);
                setHintDraft('');
              }}
              disabled={busy}
              style={{
                padding: '8px 16px',
                background: 'transparent',
                border: '1px solid #374151',
                borderRadius: 8,
                color: '#9ca3af',
                cursor: 'pointer',
                fontSize: 13,
              }}
            >
              取消
            </button>
            <button
              onClick={() => submitRegenerate(openIndex)}
              disabled={busy}
              style={{
                padding: '8px 16px',
                background: busy ? '#4b5563' : 'linear-gradient(90deg, #fbbf24, #f59e0b)',
                border: 'none',
                borderRadius: 8,
                color: '#0b0f17',
                fontWeight: 700,
                cursor: busy ? 'wait' : 'pointer',
                fontSize: 13,
              }}
            >
              {busy ? '提交中…' : '🔄 重新生成'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Thumb({
  jobId,
  chapter,
  onClickRegen,
}: {
  jobId: string;
  chapter: ChapterImageInfo;
  onClickRegen: () => void;
}) {
  const isDone = chapter.status === 'done';
  const isGenerating = chapter.status === 'generating';
  const isFailed = chapter.status === 'failed';
  // status 变化时拿新版图——状态做版本号
  const imgSrc = `/api/chapter-images/${jobId}/${chapter.index}/image?v=${chapter.status}`;

  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: 8}}>
      <div
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '9 / 16',
          borderRadius: 10,
          overflow: 'hidden',
          border: '1px solid #374151',
          background: '#06090f',
        }}
      >
        {isDone ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imgSrc}
            alt={chapter.title}
            style={{width: '100%', height: '100%', objectFit: 'cover', display: 'block'}}
          />
        ) : (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              color: isFailed ? '#fca5a5' : '#6b7280',
              fontSize: 11,
              padding: 12,
              textAlign: 'center',
            }}
          >
            {isGenerating ? (
              <>
                <Spinner />
                <div>生成中…</div>
              </>
            ) : isFailed ? (
              <>
                <div style={{fontSize: 28}}>✗</div>
                <div>{chapter.error?.slice(0, 40) || '失败'}</div>
              </>
            ) : (
              <>
                <div style={{fontSize: 24}}>⏳</div>
                <div>等待生成</div>
              </>
            )}
          </div>
        )}

        {/* 状态徽章 */}
        <div
          style={{
            position: 'absolute',
            top: 6,
            left: 6,
            padding: '2px 8px',
            borderRadius: 999,
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: 1,
            ...badgeStyle(chapter.status),
          }}
        >
          {chapter.status === 'done'
            ? '✓ 就绪'
            : chapter.status === 'generating'
              ? '⏳ 生成中'
              : chapter.status === 'failed'
                ? '✗ 失败'
                : '○ 待生成'}
        </div>

        {/* 章节序号 */}
        <div
          style={{
            position: 'absolute',
            top: 6,
            right: 6,
            padding: '2px 8px',
            borderRadius: 6,
            fontSize: 10,
            color: '#fff',
            background: 'rgba(0,0,0,0.6)',
            fontFamily: 'monospace',
            letterSpacing: 1,
          }}
        >
          CH{String(chapter.index + 1).padStart(2, '0')}
        </div>
      </div>

      <div
        style={{
          color: '#e5e7eb',
          fontSize: 12,
          fontWeight: 600,
          textAlign: 'center',
          minHeight: 16,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
        title={chapter.title}
      >
        {chapter.title}
      </div>

      <button
        onClick={onClickRegen}
        disabled={isGenerating}
        style={{
          padding: '6px 10px',
          background: isGenerating ? 'rgba(255,255,255,0.04)' : 'rgba(251,191,36,0.1)',
          border: `1px solid ${isGenerating ? '#374151' : 'rgba(251,191,36,0.35)'}`,
          borderRadius: 8,
          color: isGenerating ? '#6b7280' : '#fde68a',
          fontSize: 12,
          cursor: isGenerating ? 'not-allowed' : 'pointer',
          fontWeight: 600,
        }}
      >
        🔄 重生
      </button>
    </div>
  );
}

function Spinner() {
  return (
    <Fragment>
      <span
        style={{
          width: 22,
          height: 22,
          border: '3px solid rgba(251,191,36,0.25)',
          borderTopColor: '#fbbf24',
          borderRadius: '50%',
          animation: 'spin 0.9s linear infinite',
          display: 'inline-block',
        }}
      />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </Fragment>
  );
}

function badgeStyle(status: ChapterImageStatus): {color: string; background: string} {
  switch (status) {
    case 'done':
      return {color: '#a7f3d0', background: 'rgba(74,222,128,0.2)'};
    case 'generating':
      return {color: '#fde68a', background: 'rgba(251,191,36,0.25)'};
    case 'failed':
      return {color: '#fca5a5', background: 'rgba(239,68,68,0.2)'};
    default:
      return {color: '#9ca3af', background: 'rgba(0,0,0,0.5)'};
  }
}
