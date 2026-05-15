import {chatCompletion, extractToolArgs} from './minimax-chat';

const SYSTEM = `你是 AI 绘图提示词写手。给你播客一个章节的「中文标题」+「章节字幕节选」+ 可选的「用户提示」，输出**一句英文提示词**用来让 image-01 出 9:16 的章节背景图。

要求：
- cinematic dark editorial illustration 风格
- **NO text, NO people**（避免人脸糊）
- 抽象象征手法（蜡烛 / 山峰 / 古书 / K 线 / 迷雾 / 阶梯 等隐喻物）
- deep navy + crimson + gold 配色基调
- 9:16 vertical composition

如果用户提示了某个具象意象或方向（如"画得更暗一点"、"用瀑布隐喻"），优先采纳。
只调一次 propose_prompt 工具，不要返回除工具调用外的任何文本。`;

export async function regenerateImagePrompt(opts: {
  apiKey: string;
  chapterTitle: string;
  cuesText: string; // 章节字幕节选（拼好的中文文本）
  currentPrompt?: string;
  userHint?: string;
  model?: string;
}): Promise<string> {
  const {apiKey, chapterTitle, cuesText, currentPrompt, userHint, model} = opts;

  const userMessage = `章节标题：${chapterTitle}

章节字幕节选：
${cuesText.slice(0, 2000)}

${currentPrompt ? `上次的英文提示词（参考，不一定要保留）：\n${currentPrompt}\n` : ''}
${userHint?.trim() ? `用户额外提示：${userHint.trim()}\n` : ''}
请综合以上信息产出新的英文提示词。`;

  const res = await chatCompletion({
    apiKey,
    model,
    // 重新生成倾向用稍高一点 temperature 让结果多样
    temperature: 0.7,
    maxTokens: 512,
    messages: [
      {role: 'system', content: SYSTEM},
      {role: 'user', content: userMessage},
    ],
    tools: [
      {
        type: 'function',
        function: {
          name: 'propose_prompt',
          description: '提交新的英文 AI 绘图提示词',
          parameters: {
            type: 'object',
            properties: {
              imagePrompt: {
                type: 'string',
                description: '英文 AI 绘图提示词，符合系统要求',
              },
            },
            required: ['imagePrompt'],
          },
        },
      },
    ],
    toolChoice: {type: 'function', function: {name: 'propose_prompt'}},
  });

  const {imagePrompt} = extractToolArgs<{imagePrompt: string}>(res, 'propose_prompt');
  if (!imagePrompt || typeof imagePrompt !== 'string') {
    throw new Error('LLM 没返回 imagePrompt');
  }
  return imagePrompt.trim();
}
