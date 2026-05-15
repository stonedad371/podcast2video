const CHAT_ENDPOINT = 'https://api.minimaxi.com/v1/text/chatcompletion_v2';

export type ChatMessage = {role: 'system' | 'user' | 'assistant'; content: string};

export type ToolDef = {
  type: 'function';
  function: {
    name: string;
    description?: string;
    parameters: object; // JSON Schema
  };
};

export type ChatOptions = {
  apiKey: string;
  model?: string;
  messages: ChatMessage[];
  tools?: ToolDef[];
  toolChoice?: 'auto' | {type: 'function'; function: {name: string}};
  maxTokens?: number;
  temperature?: number;
};

type ToolCallResponse = {
  id: string;
  type: 'function';
  function: {name: string; arguments: string};
};

type ChatResponse = {
  base_resp?: {status_code?: number; status_msg?: string};
  choices?: Array<{
    message?: {
      content?: string;
      tool_calls?: ToolCallResponse[];
    };
  }>;
};

export async function chatCompletion(opts: ChatOptions): Promise<ChatResponse> {
  const {
    apiKey,
    model = 'MiniMax-M2',
    messages,
    tools,
    toolChoice,
    maxTokens = 4096,
    temperature = 0.4,
  } = opts;

  const body: Record<string, unknown> = {
    model,
    messages,
    max_tokens: maxTokens,
    temperature,
  };
  if (tools && tools.length > 0) body.tools = tools;
  if (toolChoice) body.tool_choice = toolChoice;

  const res = await fetch(CHAT_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`MiniMax chat HTTP ${res.status}: ${text.slice(0, 300)}`);
  }

  const data = (await res.json()) as ChatResponse;
  if (data.base_resp?.status_code !== undefined && data.base_resp.status_code !== 0) {
    throw new Error(`MiniMax chat: ${data.base_resp.status_msg ?? '未知错误'}`);
  }
  return data;
}

/** 从一次 chat 响应里提取首个 tool call 的 arguments，已经 JSON.parse */
export function extractToolArgs<T>(res: ChatResponse, expectedName?: string): T {
  const toolCall = res.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall) {
    // 备用：尝试从 content 里抠 JSON
    const content = res.choices?.[0]?.message?.content ?? '';
    const match = content.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]) as T;
      } catch {
        throw new Error('LLM 既未调用工具，也未返回可解析的 JSON');
      }
    }
    throw new Error('LLM 没返回工具调用');
  }
  if (expectedName && toolCall.function.name !== expectedName) {
    throw new Error(`LLM 调了错的工具 ${toolCall.function.name}（期望 ${expectedName}）`);
  }
  return JSON.parse(toolCall.function.arguments) as T;
}
