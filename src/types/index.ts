// 严重级别：用于排序、阈值判断与报告输出
export type Severity = 'low' | 'medium' | 'high' | 'critical';

export type LlmProvider = 'openai' | 'compatible' | 'local';

export type LlmScanMode = 'targeted' | 'balanced' | 'full';

// 规则定义：支持 regex 与 ast 两类规则
export interface Rule {
  id: string;
  name: string;
  description: string;
  severity: Severity;
  type: 'regex' | 'ast' | 'config' | 'llm';
  pattern?: string;
  selector?: string;
  fix?: string;
  tags?: string[];
  group?: string;
  confidence?: number; // 规则置信度
}

// 漏洞结果：记录规则命中位置、代码片段与修复建议
export interface Vulnerability {
  ruleId: string;
  description: string;
  severity: Severity;
  file: string;
  line?: number;
  column?: number;
  codeSnippet?: string;
  suggestion?: string;
  confidence?: number; // 结果置信度（主要用于 LLM 输出）
}

export interface LlmFinding {
  id: string;
  title: string;
  category: string;
  severity: Severity;
  confidence: 'low' | 'medium' | 'high';
  needsReview: boolean;
  file: string;
  line?: number;
  column?: number;
  evidence?: string;
  attackScenario?: string;
  fix?: string;
  safeAlternative?: string;
  relatedRuleIds?: string[];
  provider?: LlmProvider;
  model?: string;
  promptHash?: string;
}

export interface LlmStats {
  calls: number;
  cacheHits: number;
  failures: number;
  durationMs: number;
}

// 扫描结果：包含漏洞列表与统计信息
export interface ScanResult {
  vulnerabilities: Vulnerability[];
  llm?: {
    findings: LlmFinding[];
    stats: LlmStats;
  };
  stats: {
    filesScanned: number;
    issuesFound: number;
    durationMs: number;
  };
}

export interface LlmCacheConfig {
  enabled?: boolean;
  dir?: string;
}

export interface LlmRedactConfig {
  enabled?: boolean;
}

export interface LlmConfig {
  enabled?: boolean;
  provider?: LlmProvider;
  mode?: LlmScanMode;
  baseUrl?: string;
  model?: string;
  apiKey?: string;
  apiKeyEnv?: string;
  timeoutMs?: number;
  maxConcurrency?: number;
  includeEvidenceLines?: number;
  gate?: boolean;
  cache?: LlmCacheConfig;
  redact?: LlmRedactConfig;
}

// 运行配置：支持配置文件与 CLI 覆盖
export interface SkillConfig {
  include?: string[];
  exclude?: string[];
  rules?: Rule[];
  customRulesPath?: string;
  rulesDir?: string;
  enabledGroups?: string[];
  disabledRuleIds?: string[];
  baselinePath?: string;
  writeBaseline?: boolean;
  outputFormat?: 'md' | 'json' | 'sarif';
  failOn?: Severity;
  preset?: string; // 预设配置名称
  // LLM 配置
  useLlm?: boolean;
  apiKey?: string;
  llmModel?: string;
  llmEndpoint?: string;
  llmMaxFiles?: number; // 限制 LLM 扫描的最大文件数
  llm?: LlmConfig;
}
