import type {Cue} from './parseSrt';
import type {Chapter, Quote, PublishMeta} from './jobs';
import {chatCompletion, extractToolArgs} from './minimax-chat';

export type AnalysisResult = {
  title: string;
  subtitle: string;
  chapters: Chapter[];
  quotes: Quote[];
  publishMeta: PublishMeta;
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
   - imagePrompt：一句**英文** AI 绘图提示词。**4-6 张章节图必须保持一致的艺术方向**——同样的暗色编辑插画风格、同样的配色基调、同样的笔触质感，只换主体象征物。
     必须包含的固定风格关键词（每张图都加）：
     "cinematic dark editorial illustration, moody dramatic lighting, deep navy background with crimson and gold accents, subtle film grain texture, hand-painted brushwork feel, vertical 9:16 composition, NO text NO people"
     按本章节内容**只换**主体象征物（蜡烛/山峰/古书/K 线/迷雾/阶梯/瀑布/风暴 等抽象隐喻）和构图。
   - 例子（章节"至暗时刻"）：'A single dying candle on dark velvet floor, centered, cinematic dark editorial illustration, moody dramatic lighting, deep navy background with crimson and gold accents, subtle film grain texture, hand-painted brushwork feel, vertical 9:16 composition, NO text NO people'
   - 例子（章节"翻盘时刻"）：'A staircase of glowing candles ascending into golden light, low angle, cinematic dark editorial illustration, moody dramatic lighting, deep navy background with crimson and gold accents, subtle film grain texture, hand-painted brushwork feel, vertical 9:16 composition, NO text NO people'
   第一个章节必须从 0 秒开始。章节边界要选在内容/话题切换的自然点。
3. 挑出 3 到 5 句话作为金句（适合在视频中放大显示的情绪点 / 观点 / 戏剧转折）。每句金句要：
   - 内容完整（如果一句话被 SRT 切成多条 cue，要合并成完整意思）
   - 起始时间用第一条 cue 的 startSec，持续时间 = (最后一条 cue 的 endSec - 第一条 cue 的 startSec)
   - 文本里如果是两个分句，用 \\n 换行
4. 给出**发布到短视频平台**（抖音 / 小红书 / 视频号）用的文案，跟视频内"title"可以不同——视频内 title 要严谨有信息量，发布文案要**抓点击**：
   - platformTitle：15-30 字中文，加点钩子（数字/反差/悬念/吸睛词如"亲测""真相""被裁那天"）。可以带 1-2 个 emoji 但别滥用
   - description：50-200 字简介，引入故事钩子 + 1-2 句视频亮点 + 引导（"看完更新认知"之类，自然不油腻）。可以分 2-3 段，用换行
   - tags：5-10 个中文关键词（**不带 # 号**），覆盖：核心主题（如"交易""副业"）、人物身份（如"程序员"）、情绪/痛点（如"焦虑""躺平"）、平台常用标签（如"个人成长"）

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
              publishMeta: {
                type: 'object',
                description: '发布到短视频平台用的标题/描述/标签',
                properties: {
                  platformTitle: {
                    type: 'string',
                    description: '15-30 字带钩子的发布标题（可含少量 emoji）',
                  },
                  description: {
                    type: 'string',
                    description: '50-200 字简介，含故事钩子 + 视频亮点 + 自然引导',
                  },
                  tags: {
                    type: 'array',
                    items: {type: 'string'},
                    minItems: 5,
                    maxItems: 10,
                    description: '5-10 个中文关键词标签，不带 # 号',
                  },
                },
                required: ['platformTitle', 'description', 'tags'],
              },
            },
            required: ['title', 'subtitle', 'chapters', 'quotes', 'publishMeta'],
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
