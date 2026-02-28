export interface RedactResult {
  redactedText: string;
  changed: boolean;
}

const REDACT_PATTERNS: Array<{ id: string; pattern: RegExp; replacement: string }> = [
  {
    id: 'private_key_block',
    pattern: /-----BEGIN ([A-Z ]*?)PRIVATE KEY-----[\s\S]*?-----END ([A-Z ]*?)PRIVATE KEY-----/g,
    replacement: '-----BEGIN PRIVATE KEY-----[已脱敏]-----END PRIVATE KEY-----'
  },
  {
    id: 'bearer_token',
    pattern: /(Authorization\s*:\s*Bearer\s+)[A-Za-z0-9\-._~+/]+=*/gi,
    replacement: '$1[已脱敏]'
  },
  {
    id: 'api_key_assignment',
    pattern: /(\b(api[_-]?key|token|secret|password)\b\s*[:=]\s*)[^\s'"]+/gi,
    replacement: '$1[已脱敏]'
  },
  {
    id: 'jwt_like',
    pattern: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g,
    replacement: '[已脱敏JWT]'
  }
];

/**
 * 对文本进行基础脱敏，降低向大模型外发敏感信息的风险
 * @param {string} input - 原始文本
 * @returns {RedactResult} 脱敏结果（包含是否发生替换）
 */
export function redactText(input: string): RedactResult {
  let output = input;
  let changed = false;

  for (const item of REDACT_PATTERNS) {
    const next = output.replace(item.pattern, item.replacement);
    if (next !== output) {
      changed = true;
      output = next;
    }
  }

  return { redactedText: output, changed };
}

