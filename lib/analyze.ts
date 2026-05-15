import type {Cue} from './parseSrt';
import type {Chapter, Quote} from './jobs';
import {chatCompletion, extractToolArgs} from './minimax-chat';

export type AnalysisResult = {
  title: string;
  subtitle: string;
  chapters: Chapter[];
  quotes: Quote[];
};

const SYSTEM_PROMPT = `你是一位资深的播客视频编辑。给你一份带时间戳的字幕（SRT 解析后的 cues），任务是：

1. 给整集播客起一个**有信息量的中文短标题**（8-16 字），不要泛泛而谈，要点出核心冲突 / 反差 / 关键人物 / 关键数字。
   - 反例（不要）："交易者访谈"、"播客分享"、"投资经验谈"
   - 正例：'8 年亏货到稳定盈利：交易者的至暗与翻盘'、'被裁那天，我建了月入 10 万的副业'
   - 如果用户已经给了播客标题，可以润色或保留，但要保证最终标题**有信息量**。
1b. 再给一句**副标题**（6-14 字），是对正标题的进一步补充或好奇钩子，不要重复正标题的关键词。
   - 例子（正标题→副标题）："8 年亏货到稳定盈利" → "他用一个动作扭转了一切"
2. 把整集播客切成 4 到 6 个章节，每个章节给：
   - title：简短有力的中文小标题（10 字以内最好）
   - imagePrompt：一句**英文** AI 绘图提示词，描述与本章节内容呼应的画面。要求：
     * cinematic dark editorial illustration 风格
     * NO text, NO people（避免人脸糊掉）
     * 抽象象征手法（如蜡烛/山峰/书本/K线/迷雾 等隐喻物体）
     * deep navy + crimson + gold 配色基调
     * 9:16 vertical composition
   - 例子（章节"至暗时刻"）：'A single dying candle on dark velvet, deep navy background, crimson reflections, cinematic dark editorial illustration, moody dramatic lighting, vertical 9:16, no text, no people'
   第一个章节必须从 0 秒开始。章节边界要选在内容/话题切换的自然点。
3. 挑出 3 到 5 句话作为金句（适合在视频中放大显示的情绪点 / 观点 / 戏剧转折）。每句金句要：
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
              title: {
                type: 'string',
                description: '8-16 字的中文播客视频标题，要有信息量、点出核心冲突或关键事实',
              },
              subtitle: {
                type: 'string',
                description: '6-14 字的中文副标题，作为正标题的钩子或补充',
              },
              chapters: {
                type: 'array',
                minItems: 4,
                maxItems: 6,
                items: {
                  type: 'object',
                  properties: {
                    atSec: {type: 'number', description: '章节起点（秒）。第一个必须 0。'},
                    title: {type: 'string', description: '章节中文小标题（10 字以内）'},
                    imagePrompt: {
                      type: 'string',
                      description: '英文 AI 绘图提示词，9:16 vertical 暗色编辑插画风、抽象象征、无文字无人物',
                    },
                  },
                  required: ['atSec', 'title', 'imagePrompt'],
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
            required: ['title', 'subtitle', 'chapters', 'quotes'],
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
