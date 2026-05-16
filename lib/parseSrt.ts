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

// 字幕时间轴校准：常见 ASR 出的 SRT 时间戳是「绝对秒数」——开头有片头音乐时
// cue[0].startSec > 0、末尾有片尾音乐时 lastCueEnd < audioDurationSec，这都正常，
// 字幕不应该被拉伸。只有当 SRT 时间轴跟音频时长**严重不匹配**（>20% 偏差，
// 比如时间戳是错的相对秒数）才线性校准。
export const computeTimeScale = (audioDurationSec: number, cues: Cue[]): number => {
  if (cues.length === 0 || audioDurationSec <= 0) return 1;
  const lastEnd = cues[cues.length - 1].endSec;
  if (lastEnd <= 0) return 1;
  const ratio = audioDurationSec / lastEnd;
  // 0.8 ~ 1.25 之间不动——这范围内通常是片头/片尾音乐导致的差异，不是 SRT bug
  if (ratio >= 0.8 && ratio <= 1.25) return 1;
  return ratio;
};

export const uniqueSpeakers = (cues: Cue[]): string[] => {
  const set = new Set<string>();
  for (const c of cues) {
    if (c.speaker) set.add(c.speaker);
  }
  return Array.from(set);
};
