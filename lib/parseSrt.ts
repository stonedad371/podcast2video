export type Cue = {
  index: number;
  startSec: number;
  endSec: number;
  text: string;
  speaker: string | null;
};

const TIMESTAMP =
  /(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})\s*-->\s*(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})/;
const SPEAKER_PREFIX = /^\s*[\[【](.+?)[\]】]\s*/;

const toSec = (h: string, m: string, s: string, ms: string) =>
  Number(h) * 3600 + Number(m) * 60 + Number(s) + Number(ms.padEnd(3, '0')) / 1000;

const splitSpeaker = (raw: string): {speaker: string | null; text: string} => {
  const match = raw.match(SPEAKER_PREFIX);
  if (!match) return {speaker: null, text: raw};
  return {speaker: match[1].trim(), text: raw.slice(match[0].length).trim()};
};

export function parseSrt(input: string): Cue[] {
  const text = input.replace(/\r\n/g, '\n').replace(/^﻿/, '').trim();
  const blocks = text.split(/\n\n+/);
  const cues: Cue[] = [];

  for (const block of blocks) {
    const lines = block.split('\n').filter((l) => l.trim().length > 0);
    if (lines.length === 0) continue;

    let i = 0;
    let index = cues.length + 1;
    if (/^\d+$/.test(lines[0].trim())) {
      index = Number(lines[0]);
      i = 1;
    }
    if (i >= lines.length) continue;

    const tsMatch = lines[i].match(TIMESTAMP);
    if (!tsMatch) continue;
    const [, h1, m1, s1, ms1, h2, m2, s2, ms2] = tsMatch;
    const startSec = toSec(h1, m1, s1, ms1);
    const endSec = toSec(h2, m2, s2, ms2);
    i++;

    const body = lines.slice(i).join('\n').trim();
    if (!body) continue;

    const {speaker, text: cleanText} = splitSpeaker(body);
    cues.push({index, startSec, endSec, text: cleanText, speaker});
  }

  return cues;
}

// 字幕时间轴校准：scale = audio / lastCueEnd
// 用户选择让末尾对齐（B 方案）——线性拉伸字幕，让最后一条 cue 的 endSec 落在 audioDurationSec 上。
// 代价：所有 cue 都被线性延后，开头偏移很小（10s 处偏 45ms 几乎不可见），但末尾对齐。
// 极端 ratio（<0.5 或 >2.0）说明 SRT 时间戳异常，不强行拉伸。
export const computeTimeScale = (audioDurationSec: number, cues: Cue[]): number => {
  if (cues.length === 0 || audioDurationSec <= 0) return 1;
  const lastEnd = cues[cues.length - 1].endSec;
  if (lastEnd <= 0) return 1;
  const ratio = audioDurationSec / lastEnd;
  if (ratio < 0.5 || ratio > 2.0) return 1;
  return ratio;
};

export const uniqueSpeakers = (cues: Cue[]): string[] => {
  const set = new Set<string>();
  for (const c of cues) {
    if (c.speaker) set.add(c.speaker);
  }
  return Array.from(set);
};
