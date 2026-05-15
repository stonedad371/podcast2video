'use client';

import {useEffect, useState} from 'react';

type ConfigState = {
  minimax: {configured: boolean; masked: string | null};
};

export function SettingsModal({open, onClose}: {open: boolean; onClose: () => void}) {
  const [config, setConfig] = useState<ConfigState | null>(null);
  const [minimaxKey, setMinimaxKey] = useState('');
  const [testResult, setTestResult] = useState<{ok: boolean; msg: string} | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [autoRender, setAutoRender] = useState(false);

  useEffect(() => {
    if (!open) return;
    fetch('/api/config')
      .then((r) => r.json())
      .then(setConfig);
    setAutoRender(localStorage.getItem('autoRender') === 'true');
  }, [open]);

  const toggleAutoRender = (next: boolean) => {
    setAutoRender(next);
    localStorage.setItem('autoRender', next ? 'true' : 'false');
  };

  if (!open) return null;

  const save = async () => {
    setSaving(true);
    setTestResult(null);
    try {
      const body: Record<string, string> = {};
      if (minimaxKey) body.minimax = minimaxKey;
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(body),
      });
      const data = await res.json();
      setConfig(data);
      setMinimaxKey('');
    } finally {
      setSaving(false);
    }
  };

  const test = async () => {
    if (!minimaxKey) {
      setTestResult({ok: false, msg: '请先填 key'});
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/config/test', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({key: minimaxKey}),
      });
      const data = await res.json();
      setTestResult({ok: data.ok, msg: data.message ?? data.error});
    } catch (err) {
      setTestResult({ok: false, msg: (err as Error).message});
    } finally {
      setTesting(false);
    }
  };

  const clear = async () => {
    setSaving(true);
    try {
      await fetch('/api/config', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({minimax: ''}),
      });
      const data = await fetch('/api/config').then((r) => r.json());
      setConfig(data);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.75)',
        backdropFilter: 'blur(8px)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 600,
          background: '#111827',
          borderRadius: 20,
          padding: 32,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16,
          }}
        >
          <h2 style={{fontSize: 26, fontWeight: 800, color: '#fff'}}>API Key</h2>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#9ca3af',
              fontSize: 28,
              cursor: 'pointer',
            }}
          >
            ×
          </button>
        </div>

        <p style={{color: '#9ca3af', fontSize: 14, marginBottom: 24, lineHeight: 1.6}}>
          填入 MiniMax 的 API key（同一个 key 用于文本分析 + 封面图生成）。本地存储在{' '}
          <code style={{color: '#fbbf24', fontSize: 12}}>/data/config/api-keys.json</code>
          ，不上传任何远端服务器。
        </p>

        <div
          style={{
            padding: 20,
            background: 'rgba(255,255,255,0.03)',
            borderRadius: 12,
            border: '1px solid #1f2937',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 12,
            }}
          >
            <div>
              <div style={{color: '#fff', fontSize: 18, fontWeight: 700}}>MiniMax API Key</div>
              <div style={{color: '#9ca3af', fontSize: 13, marginTop: 4}}>
                自动切章节 / 挑金句 / 生成 9:16 封面
              </div>
            </div>
            {config?.minimax.configured ? (
              <span
                style={{
                  padding: '4px 10px',
                  background: 'rgba(74,222,128,0.15)',
                  color: '#a7f3d0',
                  fontSize: 12,
                  borderRadius: 999,
                  fontFamily: 'monospace',
                }}
              >
                已配置 {config.minimax.masked}
              </span>
            ) : (
              <span style={{color: '#6b7280', fontSize: 12}}>未配置</span>
            )}
          </div>

          <div style={{display: 'flex', gap: 8, marginTop: 12}}>
            <input
              type="password"
              placeholder="粘贴 MiniMax API key"
              value={minimaxKey}
              onChange={(e) => setMinimaxKey(e.target.value)}
              style={{
                flex: 1,
                padding: '10px 14px',
                fontSize: 14,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid #374151',
                borderRadius: 8,
                color: '#e5e7eb',
                fontFamily: 'monospace',
              }}
            />
            <button
              onClick={test}
              disabled={testing}
              style={{
                padding: '10px 16px',
                background: '#374151',
                border: 'none',
                borderRadius: 8,
                color: '#e5e7eb',
                cursor: testing ? 'wait' : 'pointer',
                fontSize: 13,
              }}
            >
              {testing ? '测试中' : '测试'}
            </button>
            {config?.minimax.configured && (
              <button
                onClick={clear}
                style={{
                  padding: '10px 16px',
                  background: 'transparent',
                  border: '1px solid #374151',
                  borderRadius: 8,
                  color: '#f87171',
                  cursor: 'pointer',
                  fontSize: 13,
                }}
              >
                清除
              </button>
            )}
          </div>

          {testResult && (
            <div
              style={{
                marginTop: 10,
                padding: '8px 12px',
                background: testResult.ok ? 'rgba(74,222,128,0.1)' : 'rgba(239,68,68,0.1)',
                border: `1px solid ${
                  testResult.ok ? 'rgba(74,222,128,0.3)' : 'rgba(239,68,68,0.3)'
                }`,
                borderRadius: 8,
                color: testResult.ok ? '#a7f3d0' : '#fca5a5',
                fontSize: 13,
                lineHeight: 1.5,
              }}
            >
              {testResult.ok ? '✓' : '✗'} {testResult.msg}
            </div>
          )}

          <div style={{marginTop: 10, fontSize: 12, color: '#6b7280'}}>
            申请：
            <a
              href="https://platform.minimaxi.com/subscribe/token-plan?code=6Vt5rNAbqe&source=link"
              target="_blank"
              rel="noopener noreferrer"
              style={{color: '#fbbf24'}}
            >
              MiniMax 开放平台
            </a>
          </div>
        </div>

        <div
          style={{
            marginTop: 20,
            padding: 16,
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid #374151',
            borderRadius: 10,
          }}
        >
          <label
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 12,
              cursor: 'pointer',
              fontSize: 14,
              color: '#e5e7eb',
            }}
          >
            <input
              type="checkbox"
              checked={autoRender}
              onChange={(e) => toggleAutoRender(e.target.checked)}
              style={{marginTop: 3, cursor: 'pointer', accentColor: '#fbbf24'}}
            />
            <div>
              <div style={{fontWeight: 600}}>前序就绪后自动渲染</div>
              <div style={{color: '#9ca3af', fontSize: 12, marginTop: 4, lineHeight: 1.5}}>
                分析 + 封面都完成后，无需点「开始生成」，自动启动渲染。
              </div>
            </div>
          </label>
        </div>

        <div style={{display: 'flex', gap: 12, marginTop: 24, justifyContent: 'flex-end'}}>
          <button
            onClick={onClose}
            style={{
              padding: '12px 24px',
              background: 'transparent',
              border: '1px solid #374151',
              borderRadius: 10,
              color: '#9ca3af',
              cursor: 'pointer',
            }}
          >
            取消
          </button>
          <button
            onClick={save}
            disabled={saving || !minimaxKey}
            style={{
              padding: '12px 24px',
              background:
                saving || !minimaxKey
                  ? '#4b5563'
                  : 'linear-gradient(90deg, #fbbf24, #f59e0b)',
              border: 'none',
              borderRadius: 10,
              color: '#0b0f17',
              fontWeight: 700,
              cursor: saving || !minimaxKey ? 'not-allowed' : 'pointer',
            }}
          >
            {saving ? '保存中…' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
}
