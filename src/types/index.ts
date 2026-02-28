export type Severity = 'low' | 'medium' | 'high' | 'critical';

export type LlmProvider = 'openai' | 'compatible' | 'local';

export type LlmScanMode = 'targeted' | 'balanced' | 'full';

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
  confidence?: number;
}

export interface Vulnerability {
  ruleId: string;
  description: string;
  severity: Severity;
  file: string;
  line?: number;
  column?: number;
  codeSnippet?: string;
  suggestion?: string;
  confidence?: number;
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

export interface SkillConfig {
  include?: string[];
  exclude?: string[];
  rules?: Rule[];
  customRulesPathPath?: string;
  rulesDir?: string;
  enabledGroups?: string[];
  disabledRuleIds?: string[];
  baselinePath?: string;
  writeBaseline?: boolean;
  outputFormat?: 'md' | 'json' | 'sarif';
  failOn?: Severity;
  preset?: string;
  useLlm?: boolean;
  apiKey?: string;
  llmModel?: string;
  llmEndpoint?: string;
  llmMaxFiles?: number;
  llm?: LlmConfig;
}
