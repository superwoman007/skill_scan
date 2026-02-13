// 严重级别：用于排序、阈值判断与报告输出
export type Severity = 'low' | 'medium' | 'high' | 'critical';

// 规则定义：支持 regex 与 ast 两类规则
export interface Rule {
  id: string;
  name: string;
  description: string;
  severity: Severity;
  type: 'regex' | 'ast' | 'config';
  pattern?: string;
  selector?: string;
  fix?: string;
  tags?: string[];
  group?: string;
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
}

// 扫描结果：包含漏洞列表与统计信息
export interface ScanResult {
  vulnerabilities: Vulnerability[];
  stats: {
    filesScanned: number;
    issuesFound: number;
    durationMs: number;
  };
}

// 运行配置：支持配置文件与 CLI 覆盖
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
  useLlm?: boolean;
  analyzeIntent?: boolean;
  apiKey?: string;
  llmModel?: string;
  llmEndpoint?: string;
}
