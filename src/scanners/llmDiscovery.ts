import * as crypto from 'crypto';
import { LlmClient } from '../llm/client';
import { redactText } from '../llm/redact';
import { LlmConfig, LlmFinding, LlmStats, Severity, Vulnerability } from '../types';

export interface LlmDiscoveryResult {
  findings: LlmFinding[];
  vulnerabilities: Vulnerability[];
  stats: LlmStats;
}

export interface LlmDiscoveryScanInput {
  filePath: string;
  content: string;
}

interface EvidenceBlock {
  startLine: number;
  endLine: number;
  text: string;
}

/**
 * LLM 发现扫描器：用于识别规则难覆盖的“有害点”
 */
export class LlmDiscoveryScanner {
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
   * 创建 LLM 发现扫描器
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
   * 发现文件中的潜在有害点（必要时调用大模型）
   * @param {LlmDiscoveryScanInput} input - 输入（文件路径与内容）
   * @returns {Promise<LlmDiscoveryResult>} 发现结果
   */
  public async discover(input: LlmDiscoveryScanInput): Promise<LlmDiscoveryResult> {
    const startedAt = Date.now();
    const stats: LlmStats = { calls: 0, cacheHits: 0, failures: 0, durationMs: 0 };

    if (!this.config.enabled) {
      return { findings: [], vulnerabilities: [], stats: { ...stats, durationMs: Date.now() - startedAt } };
    }

    const blocks = buildEvidenceBlocks({
      filePath: input.filePath,
      content: input.content,
      includeEvidenceLines: this.config.includeEvidenceLines,
      mode: this.config.mode
    });

    if (blocks.length === 0) {
      return { findings: [], vulnerabilities: [], stats: { ...stats, durationMs: Date.now() - startedAt } };
    }

    const systemPrompt = buildDiscoverySystemPrompt();
    const userPrompt = buildDiscoveryUserPrompt(input.filePath, input.content, blocks);
    const promptText = this.config.redact.enabled ? redactText(userPrompt).redactedText : userPrompt;

    try {
      stats.calls += 1;
      const response = await this.client.completeJson<{
        findings: Array<{
          title: string;
          category: string;
          severity: Severity;
          confidence: 'low' | 'medium' | 'high';
          needsReview: boolean;
          evidenceLineStart?: number;
          evidenceLineEnd?: number;
          evidenceSummary?: string;
          attackScenario?: string;
          fix?: string;
          safeAlternative?: string;
        }>;
      }>({ systemPrompt, userPrompt: promptText });

      if (response.cacheHit) {
        stats.cacheHits += 1;
      }

      const findings: LlmFinding[] = [];
      const vulnerabilities: Vulnerability[] = [];

      for (const item of response.value.findings ?? []) {
        const normalizedSeverity = normalizeSeverity(item.severity);
        const evidence = selectEvidence(blocks, item.evidenceLineStart, item.evidenceLineEnd);
        const id = buildFindingId(input.filePath, item.title, item.category, item.evidenceLineStart, item.evidenceLineEnd);

        const finding: LlmFinding = {
          id,
          title: item.title,
          category: item.category,
          severity: normalizedSeverity,
          confidence: item.confidence ?? 'low',
          needsReview: item.needsReview ?? true,
          file: input.filePath,
          line: item.evidenceLineStart,
          evidence: evidence?.text ?? item.evidenceSummary,
          attackScenario: item.attackScenario,
          fix: item.fix,
          safeAlternative: item.safeAlternative,
          provider: response.provider,
          model: response.model,
          promptHash: response.promptHash
        };
        findings.push(finding);

        vulnerabilities.push({
          ruleId: buildDiscoveryRuleId(item.category),
          description: `${item.title}${item.attackScenario ? `：${item.attackScenario}` : ''}`,
          severity: normalizedSeverity,
          file: input.filePath,
          line: item.evidenceLineStart,
          codeSnippet: evidence?.text,
          suggestion: item.fix
        });
      }

      stats.durationMs = Date.now() - startedAt;
      return { findings, vulnerabilities, stats };
    } catch (error) {
      stats.failures += 1;
      stats.durationMs = Date.now() - startedAt;
      return { findings: [], vulnerabilities: [], stats };
    }
  }
}

/**
 * 生成发现扫描的 system prompt
 * @returns {string} system prompt
 */
function buildDiscoverySystemPrompt(): string {
  return [
    '你是资深安全审计专家，正在对一个“skill”项目进行安全审查。',
    '目标是识别代码/配置/提示词中可能存在的有害风险点（后门、数据外传、危险执行、供应链脚本、提示注入链路等）。',
    '你必须只输出一个 JSON 对象，禁止输出任何额外文字。',
    '如果证据不足，请将 needsReview 设为 true，confidence 降低，不要编造不存在的事实。',
    'JSON Schema：',
    '{ "findings": [ { "title": string, "category": string, "severity": "low|medium|high|critical", "confidence": "low|medium|high", "needsReview": boolean, "evidenceLineStart"?: number, "evidenceLineEnd"?: number, "evidenceSummary"?: string, "attackScenario"?: string, "fix"?: string, "safeAlternative"?: string } ] }'
  ].join('\n');
}

/**
 * 生成发现扫描的 user prompt
 * @param {string} filePath - 文件路径
 * @param {string} content - 原始文件内容
 * @param {EvidenceBlock[]} blocks - 证据片段
 * @returns {string} user prompt
 */
function buildDiscoveryUserPrompt(filePath: string, content: string, blocks: EvidenceBlock[]): string {
  const extension = extractExtension(filePath);
  const size = Buffer.byteLength(content, 'utf-8');

  return [
    `文件路径：${filePath}`,
    `文件类型：${extension || 'unknown'}`,
    `文件大小(字节)：${size}`,
    '',
    '以下是该文件中“可疑片段”（已做裁剪），请基于片段识别风险：',
    '',
    ...blocks.map((b, idx) => {
      return [
        `片段#${idx + 1} 行 ${b.startLine}-${b.endLine}:`,
        '```',
        b.text,
        '```',
        ''
      ].join('\n');
    })
  ].join('\n');
}

/**
 * 根据扫描模式与启发式规则构造证据片段
 * @param {object} params - 构造参数
 * @param {string} params.filePath - 文件路径
 * @param {string} params.content - 文件内容
 * @param {number} params.includeEvidenceLines - 上下文行数
 * @param {'targeted' | 'balanced' | 'full'} params.mode - 覆盖模式
 * @returns {EvidenceBlock[]} 证据片段列表
 */
function buildEvidenceBlocks(params: {
  filePath: string;
  content: string;
  includeEvidenceLines: number;
  mode: 'targeted' | 'balanced' | 'full';
}): EvidenceBlock[] {
  const lines = params.content.split(/\r?\n/);
  const maxBlocks = params.mode === 'full' ? 12 : params.mode === 'balanced' ? 8 : 6;

  const suspiciousLines = new Set<number>();

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? '';
    if (shouldSkipByIgnoreTag(line)) {
      continue;
    }

    if (params.mode !== 'full' && isDefinitelySafeLine(line)) {
      continue;
    }

    if (isSuspiciousLine(line, params.filePath)) {
      suspiciousLines.add(i + 1);
    }

    if (params.mode !== 'targeted') {
      const sampled = i % 80 === 0 && line.trim().length > 0;
      if (sampled) {
        suspiciousLines.add(i + 1);
      }
    }
  }

  const sorted = Array.from(suspiciousLines).sort((a, b) => a - b);
  const blocks: EvidenceBlock[] = [];

  for (const lineNumber of sorted) {
    if (blocks.length >= maxBlocks) {
      break;
    }
    const start = Math.max(1, lineNumber - params.includeEvidenceLines);
    const end = Math.min(lines.length, lineNumber + params.includeEvidenceLines);
    const text = lines.slice(start - 1, end).join('\n');

    const overlaps = blocks.some((b) => !(end < b.startLine || start > b.endLine));
    if (overlaps) {
      continue;
    }

    blocks.push({ startLine: start, endLine: end, text });
  }

  return blocks;
}

/**
 * 判断行文本是否包含扫描忽略标记
 * @param {string} line - 行文本
 * @returns {boolean} 是否忽略
 */
function shouldSkipByIgnoreTag(line: string): boolean {
  const lower = line.toLowerCase();
  return lower.includes('skill-scan-ignore');
}

/**
 * 判断是否为明显安全且无需采样的行（用于削减提示词体积）
 * @param {string} line - 行文本
 * @returns {boolean} 是否明显安全
 */
function isDefinitelySafeLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) {
    return true;
  }
  return (
    trimmed.startsWith('import ') ||
    trimmed.startsWith('from ') ||
    trimmed.startsWith('#') ||
    trimmed.startsWith('//') ||
    trimmed.startsWith('/*') ||
    trimmed.startsWith('*')
  );
}

/**
 * 基于启发式规则判断某行是否可疑
 * @param {string} line - 行文本
 * @param {string} filePath - 文件路径
 * @returns {boolean} 是否可疑
 */
function isSuspiciousLine(line: string, filePath: string): boolean {
  const lower = line.toLowerCase();

  if (filePath.endsWith('package.json')) {
    return lower.includes('preinstall') || lower.includes('postinstall') || lower.includes('prepare') || lower.includes('install');
  }

  const patterns: RegExp[] = [
    /\beval\s*\(/i,
    /\bnew\s+function\b/i,
    /\bFunction\s*\(/i,
    /\bchild_process\b/i,
    /\bexec\s*\(/i,
    /\bspawn\s*\(/i,
    /\bruntime\.exec\b/i,
    /\bos\.system\b/i,
    /\bsubprocess\./i,
    /\brequests\./i,
    /\burllib\./i,
    /\bfetch\s*\(/i,
    /\bhttp(s)?:\/\//i,
    /\bprocess\.env\b/i,
    /\bos\.environ\b/i,
    /\bbase64\b/i,
    /\bBuffer\.from\s*\(/i,
    /\batob\s*\(/i,
    /\bcurl\b/i,
    /\bwget\b/i,
    /\bbash\b/i,
    /\bpowershell\b/i,
    /\bignore (all|previous) instructions\b/i,
    /\bsystem prompt\b/i,
    /\bjailbreak\b/i,
    /\btool\b.*\bexecute\b/i
  ];

  return patterns.some((p) => p.test(line));
}

/**
 * 从证据块中选择与返回行号最匹配的块
 * @param {EvidenceBlock[]} blocks - 证据块
 * @param {number | undefined} startLine - 起始行
 * @param {number | undefined} endLine - 结束行
 * @returns {EvidenceBlock | undefined} 证据块
 */
function selectEvidence(blocks: EvidenceBlock[], startLine?: number, endLine?: number): EvidenceBlock | undefined {
  if (!startLine && !endLine) {
    return blocks[0];
  }
  const start = startLine ?? endLine ?? 1;
  const end = endLine ?? startLine ?? start;
  return blocks.find((b) => !(end < b.startLine || start > b.endLine));
}

/**
 * 生成发现类规则 ID
 * @param {string} category - 风险类别
 * @returns {string} ruleId
 */
function buildDiscoveryRuleId(category: string): string {
  const normalized = category
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `LLM-DISC-${normalized || 'UNKNOWN'}`;
}

/**
 * 生成发现结果的稳定 ID
 * @param {string} filePath - 文件路径
 * @param {string} title - 标题
 * @param {string} category - 类别
 * @param {number | undefined} startLine - 起始行
 * @param {number | undefined} endLine - 结束行
 * @returns {string} 稳定 ID
 */
function buildFindingId(filePath: string, title: string, category: string, startLine?: number, endLine?: number): string {
  const raw = `${filePath}|${category}|${title}|${startLine ?? ''}|${endLine ?? ''}`;
  return crypto.createHash('sha1').update(raw, 'utf-8').digest('hex');
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

/**
 * 提取文件扩展名
 * @param {string} filePath - 文件路径
 * @returns {string} 扩展名（不含点）
 */
function extractExtension(filePath: string): string {
  const idx = filePath.lastIndexOf('.');
  if (idx < 0) {
    return '';
  }
  return filePath.slice(idx + 1);
}
