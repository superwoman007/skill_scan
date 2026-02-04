import { glob } from 'glob';
import * as fs from 'fs';
import { ConfigManager } from './config';
import { RuleLoader } from './rules';
import { RegexScanner } from '../scanners/code';
import { AstScanner } from '../scanners/ast';
import { Rule, ScanResult, SkillConfig, Vulnerability } from '../types';

// 扫描调度器：
// - 读取配置与规则
// - 调用 Regex / AST 扫描器
// - 处理基线过滤与统计信息
export class Runner {
  private configManager: ConfigManager;

  /**
   * 创建扫描调度器
   * @param {string} [configPath] - 配置文件路径；不传使用默认配置
   * @returns {void} 无返回值
   */
  constructor(configPath?: string) {
    this.configManager = new ConfigManager(configPath);
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
    
    // 1) 规则加载：内置 + 配置内规则 + 自定义文件 + 规则目录
    let rules = RuleLoader.loadBuiltinRules();
    if (config.rules) {
      rules = [...rules, ...config.rules];
    }
    if (config.customRulesPath) {
      const customRules = RuleLoader.loadCustomRules(config.customRulesPath);
      rules = [...rules, ...customRules];
    }
    if (config.rulesDir) {
      const dirRules = RuleLoader.loadRulesFromDirectory(config.rulesDir);
      rules = [...rules, ...dirRules];
    }
    rules = this.filterRules(rules, config.enabledGroups, config.disabledRuleIds);

    // 2) 初始化扫描器
    const regexScanner = new RegexScanner(rules);
    const astScanner = new AstScanner(rules);

    const vulnerabilities: Vulnerability[] = [];
    let filesScanned = 0;

    // 3) 单文件扫描：直接读取内容并运行两个扫描器
    if (fs.existsSync(targetDir) && fs.statSync(targetDir).isFile()) {
      try {
        const content = fs.readFileSync(targetDir, 'utf-8');
        const results = await regexScanner.scan(targetDir, content);
        const astResults = await astScanner.scan(targetDir, content);
        vulnerabilities.push(...results, ...astResults);
        filesScanned = 1;
      } catch (err) {
        console.error(`Error scanning file ${targetDir}:`, err);
      }
      const filteredVulnerabilities = this.applyBaselineFilter(vulnerabilities, config.baselinePath, config.writeBaseline);
      return {
        vulnerabilities: filteredVulnerabilities,
        stats: {
          filesScanned,
          issuesFound: filteredVulnerabilities.length,
          durationMs: Date.now() - startTime
        }
      };
    }

    // 4) 目录扫描：按 include 模式展开文件列表
    for (const pattern of config.include || []) {
      const files = await glob(pattern, {
        ignore: config.exclude,
        nodir: true,
        absolute: true,
        cwd: targetDir
      });

      for (const file of files) {
        filesScanned++;
        try {
          const content = fs.readFileSync(file, 'utf-8');
          const results = await regexScanner.scan(file, content);
          const astResults = await astScanner.scan(file, content);
          vulnerabilities.push(...results);
          vulnerabilities.push(...astResults);
        } catch (err) {
          console.error(`Error scanning file ${file}:`, err);
        }
      }
    }

    // 5) 基线过滤：用于忽略历史遗留告警
    const filteredVulnerabilities = this.applyBaselineFilter(vulnerabilities, config.baselinePath, config.writeBaseline);
    return {
      vulnerabilities: filteredVulnerabilities,
      stats: {
        filesScanned,
        issuesFound: filteredVulnerabilities.length,
        durationMs: Date.now() - startTime
      }
    };
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
   * @returns {void} 无返回值
   */
  private writeBaseline(filePath: string, items: string[]) {
    try {
      fs.writeFileSync(filePath, JSON.stringify({ items }, null, 2));
    } catch (err) {
      console.error(`Error writing baseline to ${filePath}:`, err);
    }
  }
}
