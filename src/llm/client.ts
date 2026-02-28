import * as crypto from 'crypto';
import { FileCache } from './cache';
import { parseFirstJsonObject } from './json';
import { Semaphore } from './semaphore';
import { LlmConfig, LlmProvider } from '../types';

export interface LlmJsonRequest {
  systemPrompt: string;
  userPrompt: string;
}

export interface LlmJsonResponse<T> {
  value: T;
  rawText: string;
  provider: LlmProvider;
  model?: string;
  promptHash: string;
  cacheHit: boolean;
}

export interface LlmClient {
  /**
   * 调用大模型并返回结构化 JSON
   * @template T 返回 JSON 的类型
   * @param {LlmJsonRequest} request - 调用参数（system/user 提示词）
   * @returns {Promise<LlmJsonResponse<T>>} 结构化返回与元信息
   */
  completeJson<T>(request: LlmJsonRequest): Promise<LlmJsonResponse<T>>;
}

/**
 * 创建一个基于 OpenAI 兼容接口的 LLM 客户端
 * @param {LlmConfig} config - LLM 配置（enabled 为 true 时才会调用）
 * @returns {LlmClient} 客户端实例
 */
export function createLlmClient(config: LlmConfig): LlmClient {
  const provider = (config.provider ?? 'compatible') as LlmProvider;
  const model = config.model;
  const endpoint = normalizeEndpoint(provider, config.baseUrl);
  const apiKey = resolveApiKey(provider, config.apiKeyEnv);
  const timeoutMs = config.timeoutMs ?? 30000;
  const semaphore = new Semaphore(config.maxConcurrency ?? 2);
  const cache = config.cache?.enabled ? new FileCache(config.cache.dir ?? '.skill-scan-cache') : undefined;

  return {
    async completeJson<T>(request: LlmJsonRequest): Promise<LlmJsonResponse<T>> {
      const promptHash = sha256(`${provider}|${model ?? ''}|${request.systemPrompt}|${request.userPrompt}`);

      if (cache) {
        const cached = await cache.get<{ rawText: string; value: T }>(promptHash);
        if (cached.hit && cached.value) {
          return {
            value: cached.value.value,
            rawText: cached.value.rawText,
            provider,
            model,
            promptHash,
            cacheHit: true
          };
        }
      }

      const release = await semaphore.acquire();
      try {
        const rawText = await callChatCompletions({
          endpoint,
          apiKey,
          model,
          timeoutMs,
          systemPrompt: request.systemPrompt,
          userPrompt: request.userPrompt
        });

        const parsed = parseFirstJsonObject(rawText) as T;
        if (cache) {
          await cache.set(promptHash, { rawText, value: parsed });
        }

        return {
          value: parsed,
          rawText,
          provider,
          model,
          promptHash,
          cacheHit: false
        };
      } finally {
        release();
      }
    }
  };
}

interface ChatCallParams {
  endpoint: string;
  apiKey?: string;
  model?: string;
  timeoutMs: number;
  systemPrompt: string;
  userPrompt: string;
}

/**
 * 调用 OpenAI 兼容的 chat/completions 接口
 * @param {ChatCallParams} params - 调用参数
 * @returns {Promise<string>} 返回 message.content 文本
 */
async function callChatCompletions(params: ChatCallParams): Promise<string> {
  const url = params.endpoint;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), params.timeoutMs);

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    if (params.apiKey) {
      headers.Authorization = `Bearer ${params.apiKey}`;
    }

    const body: Record<string, unknown> = {
      model: params.model,
      temperature: 0,
      messages: [
        { role: 'system', content: params.systemPrompt },
        { role: 'user', content: params.userPrompt }
      ],
      response_format: { type: 'json_object' }
    };

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal
    });

    const text = await res.text();
    if (!res.ok) {
      const retryWithoutResponseFormat = res.status === 400 && text.includes('response_format');
      if (retryWithoutResponseFormat) {
        return callChatCompletionsWithoutResponseFormat(params);
      }
      throw new Error(`LLM 调用失败：HTTP ${res.status} ${text}`);
    }

    const json = JSON.parse(text) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = json.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('LLM 返回内容为空');
    }
    return content;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * 兼容不支持 response_format 的实现：重试时移除此字段
 * @param {ChatCallParams} params - 调用参数
 * @returns {Promise<string>} 返回 message.content 文本
 */
async function callChatCompletionsWithoutResponseFormat(params: ChatCallParams): Promise<string> {
  const url = params.endpoint;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), params.timeoutMs);

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    if (params.apiKey) {
      headers.Authorization = `Bearer ${params.apiKey}`;
    }

    const body: Record<string, unknown> = {
      model: params.model,
      temperature: 0,
      messages: [
        { role: 'system', content: params.systemPrompt },
        { role: 'user', content: params.userPrompt }
      ]
    };

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal
    });

    const text = await res.text();
    if (!res.ok) {
      throw new Error(`LLM 调用失败：HTTP ${res.status} ${text}`);
    }

    const json = JSON.parse(text) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = json.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('LLM 返回内容为空');
    }
    return content;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * 规范化 baseUrl 并做基本校验
 * @param {LlmProvider} provider - provider 类型
 * @param {string | undefined} baseUrl - 输入 baseUrl
 * @returns {string} 规范化后的 baseUrl
 */
function normalizeEndpoint(provider: LlmProvider, endpoint?: string): string {
  const resolved = endpoint ?? (provider === 'openai' ? 'https://api.openai.com/v1/chat/completions' : '');
  if (!resolved) {
    throw new Error('LLM endpoint 未配置');
  }

  const url = new URL(resolved);
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error('LLM endpoint 必须为 http/https 协议');
  }
  if (url.username || url.password) {
    throw new Error('LLM endpoint 不允许包含用户名或密码');
  }

  const normalized = url.toString().replace(/\/+$/, '');
  if (!normalized.endsWith('/chat/completions')) {
    throw new Error('LLM endpoint 必须是完整的 /chat/completions 地址');
  }
  return normalized;
}

/**
 * 从环境变量解析 API Key
 * @param {LlmProvider} provider - provider 类型
 * @param {string | undefined} apiKeyEnv - 环境变量名
 * @returns {string | undefined} API Key
 */
function resolveApiKey(provider: LlmProvider, apiKeyEnv?: string): string | undefined {
  if (provider === 'local') {
    return undefined;
  }
  const envName = apiKeyEnv ?? 'SKILL_SCAN_LLM_API_KEY';
  return process.env[envName];
}

/**
 * 计算 sha256 哈希
 * @param {string} input - 输入字符串
 * @returns {string} hash 字符串
 */
function sha256(input: string): string {
  return crypto.createHash('sha256').update(input, 'utf-8').digest('hex');
}
