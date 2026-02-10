import { LlmClient } from '../llm/client';
import { redactText } from '../llm/redact';
import { LlmConfig, LlmFinding, LlmStats, Severity, Vulnerability } from '../types';

export interface LlmEnrichResult {
  findings: LlmFinding[];
  stats: LlmStats;
}

/**
 * LLM 增强器：对已有漏洞进行语义复核与修复建议补全
 */
export class LlmEnricher {
  private readonly client: LlmClient;
  private readonly config: {
    enabled: boolean;
    provider: NonNullable<LlmConfig['provider']>;
    mode: NonNullable<LlmConfig['mode']>;
    baseUrl?: string;
    model?: string;
    apiKey?: string;
    apiKeyEnv: string;
    timeoutMs: number;
    maxConcurrency: number;
    includeEvidenceLines: number;
    gate: boolean;
    cache: { enabled: boolean; dir: string };
    redact: { enabled: boolean };
  };

  /**
   * 创建 LLM 增强器
   * @param {LlmClient} client - LLM 客户端
   * @param {LlmConfig} config - LLM 配置
   * @returns {void} 无返回值
   */
  constructor(client: LlmClient, config: LlmConfig) {
    this.client = client;
    this.config = {
      enabled: config.enabled ?? false,
      provider: config.provider ?? 'compatible',
      mode: config.mode ?? 'targeted',
      baseUrl: config.baseUrl,
      model: config.model,
      apiKey: config.apiKey,
      apiKeyEnv: config.apiKeyEnv ?? 'SKILL_SCAN_LLM_API_KEY',
      timeoutMs: config.timeoutMs ?? 30000,
      maxConcurrency: config.maxConcurrency ?? 2,
      includeEvidenceLines: config.includeEvidenceLines ?? 8,
      gate: config.gate ?? false,
      cache: {
        enabled: config.cache?.enabled ?? false,
        dir: config.cache?.dir ?? '.skill-scan-cache'
      },
      redact: {
        enabled: config.redact?.enabled ?? true
      }
    };
  }

  /**
   * 对漏洞列表做大模型增强分析
   * @param {Vulnerability[]} vulnerabilities - 漏洞列表
   * @param {Map<string, string>} fileContents - 文件内容缓存（filePath -> content）
   * @returns {Promise<LlmEnrichResult>} 增强结果
   */
  public async enrich(vulnerabilities: Vulnerability[], fileContents: Map<string, string>): Promise<LlmEnrichResult> {
    const startedAt = Date.now();
    const stats: LlmStats = { calls: 0, cacheHits: 0, failures: 0, durationMs: 0 };

    if (!this.config.enabled || vulnerabilities.length === 0) {
      return { findings: [], stats: { ...stats, durationMs: Date.now() - startedAt } };
    }

    const grouped = groupByFile(vulnerabilities);
    const findings: LlmFinding[] = [];

    for (const [file, items] of grouped) {
      const limited = items.slice(0, 8);
      const content = fileContents.get(file) ?? '';
      const systemPrompt = buildEnrichSystemPrompt();
      const userPrompt = buildEnrichUserPrompt(file, content, limited, this.config.includeEvidenceLines);
      const promptText = this.config.redact.enabled ? redactText(userPrompt).redactedText : userPrompt;

      try {
        stats.calls += 1;
        const response = await this.client.completeJson<{
          analyses: Array<{
            index: number;
            category: string;
            severity: Severity;
            confidence: 'low' | 'medium' | 'high';
            needsReview: boolean;
            falsePositive?: boolean;
            summary?: string;
            attackScenario?: string;
            fix?: string;
            safeAlternative?: string;
          }>;
        }>({ systemPrompt, userPrompt: promptText });

        if (response.cacheHit) {
          stats.cacheHits += 1;
        }

        for (const analysis of response.value.analyses ?? []) {
          const v = limited[analysis.index];
          if (!v) {
            continue;
          }

          findings.push({
            id: `${v.ruleId}|${v.file}|${v.line ?? 0}`,
            title: analysis.summary ? `复核：${analysis.summary}` : `复核：${v.ruleId}`,
            category: analysis.category ?? 'review',
            severity: normalizeSeverity(analysis.severity ?? v.severity),
            confidence: analysis.confidence ?? 'low',
            needsReview: analysis.needsReview ?? true,
            file: v.file,
            line: v.line,
            column: v.column,
            evidence: v.codeSnippet,
            attackScenario: analysis.attackScenario,
            fix: analysis.fix ?? v.suggestion,
            safeAlternative: analysis.safeAlternative,
            relatedRuleIds: [v.ruleId],
            provider: response.provider,
            model: response.model,
            promptHash: response.promptHash
          });
        }
      } catch {
        stats.failures += 1;
      }
    }

    stats.durationMs = Date.now() - startedAt;
    return { findings, stats };
  }
}

/**
 * 生成增强分析的 system prompt
 * @returns {string} system prompt
 */
function buildEnrichSystemPrompt(): string {
  return [
    '你是资深安全审计专家，请对扫描器报告的安全问题进行语义复核。',
    '要求：给出风险类别、严重度、置信度、是否可能误报、以及可执行的修复建议。',
    '你必须只输出一个 JSON 对象，禁止输出任何额外文字。',
    '如果证据不足，请将 needsReview 设为 true，confidence 降低，不要编造不存在的事实。',
    'JSON Schema：',
    '{ "analyses": [ { "index": number, "category": string, "severity": "low|medium|high|critical", "confidence": "low|medium|high", "needsReview": boolean, "falsePositive"?: boolean, "summary"?: string, "attackScenario"?: string, "fix"?: string, "safeAlternative"?: string } ] }'
  ].join('\n');
}

/**
 * 生成增强分析的 user prompt
 * @param {string} filePath - 文件路径
 * @param {string} content - 文件内容
 * @param {Vulnerability[]} vulnerabilities - 漏洞列表（同一文件）
 * @param {number} includeEvidenceLines - 上下文行数
 * @returns {string} user prompt
 */
function buildEnrichUserPrompt(
  filePath: string,
  content: string,
  vulnerabilities: Vulnerability[],
  includeEvidenceLines: number
): string {
  const lines = content ? content.split(/\r?\n/) : [];
  const items = vulnerabilities.map((v, index) => {
    const line = v.line ?? 0;
    const snippet = v.codeSnippet ?? (line > 0 && lines.length > 0 ? extractContext(lines, line, includeEvidenceLines) : '');
    return {
      index,
      ruleId: v.ruleId,
      severity: v.severity,
      line: v.line,
      description: v.description,
      snippet
    };
  });

  return [
    `文件路径：${filePath}`,
    '',
    '以下是该文件中已发现的问题列表（index 用于回填 analyses.index）：',
    JSON.stringify(items, null, 2)
  ].join('\n');
}

/**
 * 按文件路径分组
 * @param {Vulnerability[]} vulnerabilities - 漏洞列表
 * @returns {Map<string, Vulnerability[]>} 分组结果
 */
function groupByFile(vulnerabilities: Vulnerability[]): Map<string, Vulnerability[]> {
  const map = new Map<string, Vulnerability[]>();
  for (const v of vulnerabilities) {
    const list = map.get(v.file) ?? [];
    list.push(v);
    map.set(v.file, list);
  }
  return map;
}

/**
 * 从文本中提取指定行的上下文
 * @param {string[]} lines - 文件行数组
 * @param {number} line - 目标行号（从 1 开始）
 * @param {number} radius - 上下文行数
 * @returns {string} 上下文片段
 */
function extractContext(lines: string[], line: number, radius: number): string {
  const start = Math.max(1, line - radius);
  const end = Math.min(lines.length, line + radius);
  return lines.slice(start - 1, end).join('\n');
}

/**
 * 将未知输入的严重级别规范化为可用枚举
 * @param {Severity} severity - 输入严重级别
 * @returns {Severity} 输出严重级别
 */
function normalizeSeverity(severity: Severity): Severity {
  const v = (severity ?? 'low') as Severity;
  if (v === 'low' || v === 'medium' || v === 'high' || v === 'critical') {
    return v;
  }
  return 'low';
}
