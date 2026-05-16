'use client';

import {useState} from 'react';

export type PublishMetaInfo = {
  platformTitle: string;
  description: string;
  tags: string[];
};

export function PublishMetaPanel({meta}: {meta: PublishMetaInfo}) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const copy = (key: string, text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1500);
    });
  };

  const tagsLine = meta.tags.map((t) => `#${t}`).join(' ');
  const fullPost = `${meta.description}\n\n${tagsLine}`;

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
          marginBottom: 14,
        }}
      >
        <div style={{color: '#cbd5e1', fontSize: 14, fontWeight: 700, letterSpacing: 2}}>
          发布文案（抖音 / 小红书 / 视频号）
        </div>
        <button
          onClick={() => copy('full', `${meta.platformTitle}\n\n${fullPost}`)}
          style={{
            padding: '6px 12px',
            background:
              copiedKey === 'full'
                ? 'rgba(74,222,128,0.18)'
                : 'rgba(251,191,36,0.12)',
            border: `1px solid ${
              copiedKey === 'full' ? 'rgba(74,222,128,0.4)' : 'rgba(251,191,36,0.4)'
            }`,
            borderRadius: 8,
            color: copiedKey === 'full' ? '#a7f3d0' : '#fde68a',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {copiedKey === 'full' ? '✓ 已复制全文' : '📋 复制全部'}
        </button>
      </div>

      <Field
        label="发布标题"
        value={meta.platformTitle}
        onCopy={() => copy('title', meta.platformTitle)}
        copied={copiedKey === 'title'}
      />

      <Field
        label="视频简介"
        value={meta.description}
        multiline
        onCopy={() => copy('desc', meta.description)}
        copied={copiedKey === 'desc'}
      />

      <div style={{marginTop: 14}}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            marginBottom: 6,
          }}
        >
          <div style={{color: '#9ca3af', fontSize: 12, fontWeight: 600, letterSpacing: 1}}>
            话题标签
          </div>
          <button
            onClick={() => copy('tags', tagsLine)}
            style={copyBtnStyle(copiedKey === 'tags')}
          >
            {copiedKey === 'tags' ? '✓ 已复制' : '复制'}
          </button>
        </div>
        <div style={{display: 'flex', flexWrap: 'wrap', gap: 6}}>
          {meta.tags.map((t) => (
            <span
              key={t}
              style={{
                padding: '4px 10px',
                background: 'rgba(251,191,36,0.1)',
                border: '1px solid rgba(251,191,36,0.3)',
                borderRadius: 999,
                color: '#fde68a',
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              #{t}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  multiline,
  onCopy,
  copied,
}: {
  label: string;
  value: string;
  multiline?: boolean;
  onCopy: () => void;
  copied: boolean;
}) {
  return (
    <div style={{marginTop: 14}}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          marginBottom: 6,
        }}
      >
        <div style={{color: '#9ca3af', fontSize: 12, fontWeight: 600, letterSpacing: 1}}>
          {label}
        </div>
        <button onClick={onCopy} style={copyBtnStyle(copied)}>
          {copied ? '✓ 已复制' : '复制'}
        </button>
      </div>
      <div
        style={{
          padding: '12px 14px',
          background: 'rgba(0,0,0,0.25)',
          border: '1px solid #374151',
          borderRadius: 8,
          color: '#e5e7eb',
          fontSize: 14,
          lineHeight: 1.6,
          whiteSpace: multiline ? 'pre-wrap' : 'nowrap',
          overflowWrap: 'break-word',
          maxHeight: multiline ? 240 : undefined,
          overflowY: multiline ? 'auto' : undefined,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function copyBtnStyle(copied: boolean): React.CSSProperties {
  return {
    padding: '3px 10px',
    background: copied ? 'rgba(74,222,128,0.18)' : 'transparent',
    border: `1px solid ${copied ? 'rgba(74,222,128,0.4)' : '#374151'}`,
    borderRadius: 6,
    color: copied ? '#a7f3d0' : '#9ca3af',
    cursor: 'pointer',
    fontSize: 11,
  };
}
