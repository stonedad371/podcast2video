import {chatCompletion, extractToolArgs} from './minimax-chat';

const SYSTEM = `你是 AI 绘图提示词写手。给你播客一个章节的「中文标题」+「章节字幕节选」+ 可选的「用户提示」，输出**一句英文提示词**用来让 image-01 出 9:16 的章节背景图。

注意：这是同一期播客 4-6 个章节图中的一张，**所有章节图必须保持一致的艺术方向**——同样的暗色编辑插画风格、同样的配色基调、同样的笔触质感，只换主体象征物。

风格关键词（每张图都必须包含）：
- "cinematic dark editorial illustration, moody dramatic lighting, deep navy background with crimson and gold accents, subtle film grain texture, hand-painted brushwork feel, vertical 9:16 composition, NO text NO people"

变化的部分（基于本章节标题/字幕）：
- 主体象征物：蜡烛 / 山峰 / 古书 / K 线 / 迷雾 / 阶梯 / 瀑布 / 风暴 等抽象隐喻
- 构图重心位置（centered focal point / rising diagonal / receding perspective）

如果用户提示了某个具象意象或方向（如"画得更暗一点"、"用瀑布隐喻"），优先采纳，但**风格关键词必须保留**。
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
