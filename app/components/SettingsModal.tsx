'use client';

import {useEffect, useState} from 'react';

type ConfigState = {
  minimax: {configured: boolean; masked: string | null};
  brand: string;
  subtitleOffsetSec: number;
};

export function SettingsModal({open, onClose}: {open: boolean; onClose: () => void}) {
  const [config, setConfig] = useState<ConfigState | null>(null);
  const [minimaxKey, setMinimaxKey] = useState('');
  const [brandInput, setBrandInput] = useState('');
  const [offsetInput, setOffsetInput] = useState(0.2);
  const [testResult, setTestResult] = useState<{ok: boolean; msg: string} | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [autoRender, setAutoRender] = useState(false);
  const [saveToast, setSaveToast] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    fetch('/api/config')
      .then((r) => r.json())
      .then((c: ConfigState) => {
        setConfig(c);
        setBrandInput(c.brand);
        setOffsetInput(c.subtitleOffsetSec);
      });
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
    setSaveToast(null);
    try {
      const body: Record<string, string | number> = {};
      if (minimaxKey) body.minimax = minimaxKey;
      if (brandInput !== config?.brand) body.brand = brandInput;
      if (offsetInput !== config?.subtitleOffsetSec) body.subtitleOffsetSec = offsetInput;
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: ConfigState = await res.json();
      setConfig(data);
      setBrandInput(data.brand);
      setOffsetInput(data.subtitleOffsetSec);
      setMinimaxKey('');
      setSaveToast('✓ 已保存');
      setTimeout(() => setSaveToast(null), 2500);
    } catch (err) {
      setSaveToast(`✗ 保存失败：${(err as Error).message}`);
      setTimeout(() => setSaveToast(null), 4000);
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
          <h2 style={{fontSize: 26, fontWeight: 800, color: '#fff'}}>设置</h2>
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
          <div style={{fontSize: 14, fontWeight: 600, color: '#e5e7eb', marginBottom: 8}}>
            视频品牌标识
          </div>
          <div style={{color: '#9ca3af', fontSize: 12, marginBottom: 12, lineHeight: 1.5}}>
            出现在视频片头、片头钩子顶栏、主体顶部品牌条。留空恢复默认「podcast.cab」。
          </div>
          <input
            type="text"
            value={brandInput}
            onChange={(e) => setBrandInput(e.target.value)}
            placeholder="podcast.cab"
            style={{
              width: '100%',
              padding: '10px 14px',
              background: 'rgba(0,0,0,0.3)',
              border: '1px solid #374151',
              borderRadius: 8,
              color: '#e5e7eb',
              fontSize: 14,
              fontFamily: 'inherit',
            }}
          />
        </div>

        <div
          style={{
            marginTop: 12,
            padding: 16,
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid #374151',
            borderRadius: 10,
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              marginBottom: 8,
            }}
          >
            <div style={{fontSize: 14, fontWeight: 600, color: '#e5e7eb'}}>字幕时间补偿</div>
            <div
              style={{
                fontSize: 13,
                fontFamily: '"SF Mono", Menlo, monospace',
                color: '#fbbf24',
                fontWeight: 700,
              }}
            >
              {offsetInput > 0 ? '+' : ''}
              {offsetInput.toFixed(2)} 秒
            </div>
          </div>
          <div style={{color: '#9ca3af', fontSize: 12, marginBottom: 12, lineHeight: 1.5}}>
            字幕比声音早出现 → 调高（往右）；字幕比声音晚 → 调低（往左）。
            <br />
            默认 +0.20s 补偿 ASR 工具普遍的字幕提前。
          </div>
          <input
            type="range"
            min={-1}
            max={1}
            step={0.05}
            value={offsetInput}
            onChange={(e) => setOffsetInput(Number(e.target.value))}
            style={{width: '100%', accentColor: '#fbbf24'}}
          />
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 11,
              color: '#6b7280',
              fontFamily: 'monospace',
              marginTop: 4,
            }}
          >
            <span>-1.0s (提前)</span>
            <span>0</span>
            <span>+1.0s (延后)</span>
          </div>
          <button
            onClick={() => setOffsetInput(0.2)}
            style={{
              marginTop: 10,
              padding: '4px 10px',
              background: 'transparent',
              border: '1px solid #374151',
              borderRadius: 6,
              color: '#9ca3af',
              cursor: 'pointer',
              fontSize: 11,
            }}
          >
            恢复默认 +0.20s
          </button>
        </div>

        <div
          style={{
            marginTop: 12,
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

        {saveToast && (
          <div
            style={{
              marginTop: 16,
              padding: '10px 14px',
              borderRadius: 8,
              fontSize: 13,
              textAlign: 'center',
              background: saveToast.startsWith('✓')
                ? 'rgba(74,222,128,0.12)'
                : 'rgba(239,68,68,0.12)',
              border: `1px solid ${
                saveToast.startsWith('✓') ? 'rgba(74,222,128,0.35)' : 'rgba(239,68,68,0.35)'
              }`,
              color: saveToast.startsWith('✓') ? '#a7f3d0' : '#fca5a5',
            }}
          >
            {saveToast}
          </div>
        )}

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
          {(() => {
            const brandChanged = brandInput !== (config?.brand ?? '');
            const offsetChanged = offsetInput !== (config?.subtitleOffsetSec ?? 0.2);
            const nothingToSave = !minimaxKey && !brandChanged && !offsetChanged;
            const disabled = saving || nothingToSave;
            return (
              <button
                onClick={save}
                disabled={disabled}
                style={{
                  padding: '12px 24px',
                  background: disabled
                    ? '#4b5563'
                    : 'linear-gradient(90deg, #fbbf24, #f59e0b)',
                  border: 'none',
                  borderRadius: 10,
                  color: '#0b0f17',
                  fontWeight: 700,
                  cursor: disabled ? 'not-allowed' : 'pointer',
                }}
              >
                {saving ? '保存中…' : '保存'}
              </button>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
