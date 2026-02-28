import { glob } from 'glob';
import * as fs from 'fs';
import { ConfigManager } from './config';
import { RuleLoader } from './rules';
import { RegexScanner } from '../scanners/code';
import { AstScanner } from '../scanners/ast';
import { createLlmClient } from '../llm/client';
import { LlmDiscoveryScanner } from '../scanners/llmDiscovery';
import { LlmEnricher } from '../scanners/llmEnricher';
import { LlmFinding, LlmStats, Rule, ScanResult, SkillConfig, Vulnerability } from '../types';

export class Runner {
  private configManager: ConfigManager;

  /**
   * 创建扫描调度器
   * @param {string} [configPath] - 配置文件路径；不传使用默认配置
   */
  constructor(configPath?: string) {
    this.configManager = new ConfigManager(configPath);
  }

  /**
   * 列出所有可用预设配置
   */
  public listPresets(): void {
    this.configManager.listPresets();
  }

  /**
   * 执行扫描流程
   * @param {string} [targetDir] - 扫描目标路径（目录或文件），默认当前工作目录
   * @param {Partial<SkillConfig>} [overrides] - CLI 覆盖配置项
   * @returns {Promise<ScanResult>} 扫描结果与统计信息
   */
  async run(targetDir: string = process.cwd(), overrides: Partial<SkillConfig> | undefined = undefined): Promise<ScanResult> {
    const startTime = Date.now();
    if (overrides) {
      this.configManager.applyOverrides(overrides);
    }
    const config = this.configManager.getConfig();

    const rules = this.loadRules(config);

    const regexScanner = new RegexScanner(rules);
    const astScanner = new AstScanner(rules);

    const llmEnabled = Boolean(config.llm?.enabled || config.useLlm);
    const effectiveLlmConfig = {
      ...(config.llm ?? {}),
      enabled: llmEnabled,
      baseUrl: (config.llm?.baseUrl ?? config.llmEndpoint) as string | undefined,
      model: (config.llm?.model ?? config.llmModel) as string | undefined,
      apiKey: (config.llm?.apiKey ?? config.apiKey) as string | undefined,
      gate: (config.llm?.gate ?? false) as boolean
    };
    const llmClient = llmEnabled ? createLlmClient(effectiveLlmConfig) : undefined;
    const llmDiscovery = llmClient ? new LlmDiscoveryScanner(llmClient, effectiveLlmConfig) : undefined;
    const llmEnricher = llmClient ? new LlmEnricher(llmClient, effectiveLlmConfig) : undefined;

    const fileContents = await this.collectFiles(targetDir, config);

    const vulnerabilities: Vulnerability[] = [];
    const llmFindings: LlmFinding[] = [];
    const llmStats: LlmStats = { calls: 0, cacheHits: 0, failures: 0, durationMs: 0 };

    for (const [filePath, content] of fileContents) {
      try {
        const regexResults = await regexScanner.scan(filePath, content);
        const astResults = await astScanner.scan(filePath, content);
        vulnerabilities.push(...regexResults, ...astResults);
      } catch (err) {
        console.error(`Error scanning file ${filePath}:`, err);
      }
    }

    if (llmDiscovery) {
      const maxFiles = config.llmMaxFiles && config.llmMaxFiles > 0 ? config.llmMaxFiles : undefined;
      const entries = maxFiles ? Array.from(fileContents.entries()).slice(0, maxFiles) : Array.from(fileContents.entries());
      for (const [filePath, content] of entries) {
        const discoveryResult = await llmDiscovery.discover({ filePath, content });
        vulnerabilities.push(...discoveryResult.vulnerabilities);
        llmFindings.push(...discoveryResult.findings);
        mergeLlmStats(llmStats, discoveryResult.stats);
      }
    }

    const filteredVulnerabilities = this.applyBaselineFilter(vulnerabilities, config.baselinePath, config.writeBaseline);

    if (llmEnricher) {
      const enrichResult = await llmEnricher.enrich(filteredVulnerabilities, fileContents);
      llmFindings.push(...enrichResult.findings);
      mergeLlmStats(llmStats, enrichResult.stats);
    }

    return {
      vulnerabilities: filteredVulnerabilities,
      llm: llmEnabled
        ? {
            findings: filterFindingsAgainstVulnerabilities(llmFindings, filteredVulnerabilities),
            stats: llmStats
          }
        : undefined,
      stats: {
        filesScanned: fileContents.size,
        issuesFound: filteredVulnerabilities.length,
        durationMs: Date.now() - startTime
      }
    };
  }

  /**
   * 加载并过滤规则
   * @param {SkillConfig} config - 当前配置
   * @returns {Rule[]} 过滤后的规则列表
   */
  private loadRules(config: SkillConfig): Rule[] {
    let rules = RuleLoader.loadBuiltinRules();
    if (config.rules) {
      rules = [...rules, ...config.rules];
    }
    if (config.customRulesPathPath) {
      const customRules = RuleLoader.loadCustomRules(config.customRulesPathPath);
      rules = [...rules, ...customRules];
    }
    if (config.rulesDir) {
      const dirRules = RuleLoader.loadRulesFromDirectory(config.rulesDir);
      rules = [...rules, ...dirRules];
    }
    return this.filterRules(rules, config.enabledGroups, config.disabledRuleIds);
  }

  /**
   * 收集待扫描文件内容
   * @param {string} targetDir - 扫描目标路径
   * @param {SkillConfig} config - 当前配置
   * @returns {Promise<Map<string, string>>} 文件路径到内容的映射
   */
  private async collectFiles(targetDir: string, config: SkillConfig): Promise<Map<string, string>> {
    const fileContents = new Map<string, string>();

    if (fs.existsSync(targetDir) && fs.statSync(targetDir).isFile()) {
      try {
        const content = fs.readFileSync(targetDir, 'utf-8');
        fileContents.set(targetDir, content);
      } catch (err) {
        console.error(`Error reading file ${targetDir}:`, err);
      }
      return fileContents;
    }

    for (const pattern of config.include || []) {
      const files = await glob(pattern, {
        ignore: config.exclude,
        nodir: true,
        absolute: true,
        cwd: targetDir
      });

      for (const file of files) {
        try {
          const content = fs.readFileSync(file, 'utf-8');
          fileContents.set(file, content);
        } catch (err) {
          console.error(`Error reading file ${file}:`, err);
        }
      }
    }

    return fileContents;
  }

  /**
   * 按分组与禁用列表过滤规则
   * @param {Rule[]} rules - 原始规则列表
   * @param {string[]} [enabledGroups] - 启用的规则分组；为空时不过滤
   * @param {string[]} [disabledRuleIds] - 禁用的规则 ID 列表
   * @returns {Rule[]} 过滤后的规则列表
   */
  private filterRules(rules: Rule[], enabledGroups?: string[], disabledRuleIds?: string[]): Rule[] {
    let filtered = rules;
    if (enabledGroups && enabledGroups.length > 0) {
      filtered = filtered.filter((r) => r.group && enabledGroups.includes(r.group));
    }
    if (disabledRuleIds && disabledRuleIds.length > 0) {
      filtered = filtered.filter((r) => !disabledRuleIds.includes(r.id));
    }
    return filtered;
  }

  /**
   * 基线过滤逻辑
   * @param {Vulnerability[]} vulnerabilities - 当前扫描的漏洞列表
   * @param {string} [baselinePath] - 基线文件路径
   * @param {boolean} [writeBaseline] - 是否写入当前漏洞为基线
   * @returns {Vulnerability[]} 过滤后的漏洞列表
   */
  private applyBaselineFilter(vulnerabilities: Vulnerability[], baselinePath?: string, writeBaseline?: boolean): Vulnerability[] {
    if (!baselinePath) {
      return vulnerabilities;
    }

    const currentKeys = vulnerabilities.map((v) => this.signatureKey(v));
    if (writeBaseline) {
      this.writeBaseline(baselinePath, currentKeys);
      return [];
    }

    const baselineKeys = this.readBaseline(baselinePath);
    if (baselineKeys.length === 0) {
      return vulnerabilities;
    }
    return vulnerabilities.filter((v) => !baselineKeys.includes(this.signatureKey(v)));
  }

  /**
   * 生成漏洞稳定签名用于基线比对
   * @param {Vulnerability} v - 漏洞对象
   * @returns {string} 签名字符串
   */
  private signatureKey(v: Vulnerability): string {
    const line = v.line ?? 0;
    return `${v.ruleId}|${v.file}|${line}|${v.codeSnippet ?? ''}`;
  }

  /**
   * 读取基线文件
   * @param {string} filePath - 基线文件路径
   * @returns {string[]} 签名列表；读取失败返回空数组
   */
  private readBaseline(filePath: string): string[] {
    try {
      if (!fs.existsSync(filePath)) {
        return [];
      }
      const content = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        return parsed;
      }
      if (parsed && Array.isArray(parsed.items)) {
        return parsed.items;
      }
      return [];
    } catch {
      return [];
    }
  }

  /**
   * 写入基线文件
   * @param {string} filePath - 基线文件路径
   * @param {string[]} items - 漏洞签名列表
   */
  private writeBaseline(filePath: string, items: string[]) {
    try {
      fs.writeFileSync(filePath, JSON.stringify({ items }, null, 2));
    } catch (err) {
      console.error(`Error writing baseline to ${filePath}:`, err);
    }
  }
}

/**
 * 合并 LLM 统计信息
 * @param {LlmStats} target - 目标统计对象
 * @param {LlmStats} source - 来源统计对象
 */
function mergeLlmStats(target: LlmStats, source: LlmStats): void {
  target.calls += source.calls;
  target.cacheHits += source.cacheHits;
  target.failures += source.failures;
  target.durationMs += source.durationMs;
}

/**
 * 过滤无对应漏洞的 LLM 发现，避免基线过滤后残留无效记录
 * @param {LlmFinding[]} findings - LLM 发现/复核记录
 * @param {Vulnerability[]} vulnerabilities - 基线过滤后的漏洞列表
 * @returns {LlmFinding[]} 过滤后的记录
 */
function filterFindingsAgainstVulnerabilities(findings: LlmFinding[], vulnerabilities: Vulnerability[]): LlmFinding[] {
  const keys = new Set(vulnerabilities.map((v) => `${v.ruleId}|${v.file}|${v.line ?? 0}`));
  return findings.filter((f) => keys.has(`${(f.relatedRuleIds?.[0] ?? buildRuleIdFromFinding(f))}|${f.file}|${f.line ?? 0}`) || keys.has(`${buildRuleIdFromFinding(f)}|${f.file}|${f.line ?? 0}`));
}

/**
 * 从 finding 推导一个可用于匹配的 ruleId
 * @param {LlmFinding} finding - finding
 * @returns {string} ruleId
 */
function buildRuleIdFromFinding(finding: LlmFinding): string {
  if (finding.relatedRuleIds && finding.relatedRuleIds.length > 0) {
    return finding.relatedRuleIds[0];
  }
  const normalized = finding.category
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `LLM-DISC-${normalized || 'UNKNOWN'}`;
}
