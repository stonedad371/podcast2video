import type {Cue} from './parseSrt';
import type {Chapter, Quote} from './jobs';
import {chatCompletion, extractToolArgs} from './minimax-chat';

export type AnalysisResult = {
  chapters: Chapter[];
  quotes: Quote[];
};

const SYSTEM_PROMPT = `你是一位资深的播客视频编辑。给你一份带时间戳的字幕（SRT 解析后的 cues），任务是：

1. 把整集播客切成 4 到 6 个章节，每个章节给一个简短有力的中文小标题（10 字以内最好）。第一个章节必须从 0 秒开始。章节边界要选在内容/话题切换的自然点。
2. 挑出 3 到 5 句话作为金句（适合在视频中放大显示的情绪点 / 观点 / 戏剧转折）。每句金句要：
   - 内容完整（如果一句话被 SRT 切成多条 cue，要合并成完整意思）
   - 起始时间用第一条 cue 的 startSec，持续时间 = (最后一条 cue 的 endSec - 第一条 cue 的 startSec)
   - 文本里如果是两个分句，用 \\n 换行

只能调用一次 propose_video_structure 工具。不要返回除工具调用外的任何文本。`;

export async function analyzeWithLLM(opts: {
  apiKey: string;
  cues: Cue[];
  title?: string;
  subtitle?: string;
  model?: string;
}): Promise<AnalysisResult> {
  const {apiKey, cues, title, subtitle, model} = opts;

  const transcript = cues
    .map((c) => {
      const sp = c.speaker ? `[${c.speaker}] ` : '';
      return `#${c.index} ${c.startSec.toFixed(2)}-${c.endSec.toFixed(2)}s ${sp}${c.text}`;
    })
    .join('\n');

  const userMessage = `播客标题：${title || '（未提供）'}
副标题：${subtitle || '（未提供）'}
音频总长：${cues[cues.length - 1].endSec.toFixed(1)} 秒
字幕条数：${cues.length}

字幕全文（每行 = 一条 cue）：

${transcript}`;

  const res = await chatCompletion({
    apiKey,
    model,
    messages: [
      {role: 'system', content: SYSTEM_PROMPT},
      {role: 'user', content: userMessage},
    ],
    tools: [
      {
        type: 'function',
        function: {
          name: 'propose_video_structure',
          description: '提交章节切分和金句选择',
          parameters: {
            type: 'object',
            properties: {
              chapters: {
                type: 'array',
                minItems: 4,
                maxItems: 6,
                items: {
                  type: 'object',
                  properties: {
                    atSec: {type: 'number', description: '章节起点（秒）。第一个必须 0。'},
                    title: {type: 'string', description: '章节中文小标题（10 字以内）'},
                  },
                  required: ['atSec', 'title'],
                },
              },
              quotes: {
                type: 'array',
                minItems: 3,
                maxItems: 5,
                items: {
                  type: 'object',
                  properties: {
                    fromSec: {type: 'number', description: '金句起点（秒）'},
                    durationSec: {type: 'number', description: '金句持续时长（秒）'},
                    text: {type: 'string', description: '金句完整文本'},
                  },
                  required: ['fromSec', 'durationSec', 'text'],
                },
              },
            },
            required: ['chapters', 'quotes'],
          },
        },
      },
    ],
    toolChoice: {type: 'function', function: {name: 'propose_video_structure'}},
    maxTokens: 4096,
    temperature: 0.4,
  });

  const result = extractToolArgs<AnalysisResult>(res, 'propose_video_structure');

  if (result.chapters.length > 0 && result.chapters[0].atSec > 0) {
    result.chapters[0].atSec = 0;
  }
  result.chapters.sort((a, b) => a.atSec - b.atSec);

  return result;
}
