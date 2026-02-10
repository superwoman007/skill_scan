#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import AdmZip from 'adm-zip';
import { Runner } from '../core/runner';
import { LlmProvider, LlmScanMode, ScanResult, Severity, SkillConfig, Vulnerability } from '../types';

// CLI 程序入口，负责参数解析、扫描调度、报告输出与退出码控制
const program = new Command();

type ScanOptions = {
  config?: string;
  output?: string;
  format?: string;
  rulesDir?: string;
  enableGroup: string[];
  disableRule: string[];
  baseline?: string;
  writeBaseline?: boolean;
  failOn?: string;
  preset?: string;
  listPresets?: boolean;
  useLlm?: boolean;
  llm?: boolean;
  llmProvider?: string;
  llmBaseUrl?: string;
  llmModel?: string;
  llmMode?: string;
  llmGate?: boolean;
};

program
  .name('skill-scan')
  .description('技能开发安全扫描工具')
  .version('1.0.0');

program
  .command('scan [target]')
  .description('扫描项目目录或 zip 文件中的安全风险')
  .option('-c, --config <path>', '配置文件路径')
  .option('-o, --output <path>', '保存报告的路径')
  .option('-f, --format <format>', '报告格式 (md|json|sarif)')
  .option('--rules-dir <path>', '规则目录路径')
  .option('--enable-group <group>', '启用规则分组', collect, [])
  .option('--disable-rule <id>', '禁用规则ID', collect, [])
  .option('--baseline <path>', '基线文件路径')
  .option('--write-baseline', '写入当前结果为基线')
  .option('--fail-on <level>', '失败阈值 (low|medium|high|critical)')
  .option('--preset <name>', '使用预设配置')
  .option('--list-presets', '列出所有可用预设')
  .option('--use-llm', '启用 LLM 语义分析')
  .option('--llm', '启用大模型安全分析（默认关闭）')
  .option('--llm-provider <provider>', '大模型提供方 (openai|compatible|local)')
  .option('--llm-base-url <url>', '大模型接口完整端点（必须以 /chat/completions 结尾）')
  .option('--llm-model <model>', '大模型名称（如 gpt-4.1-mini）')
  .option('--llm-mode <mode>', '大模型覆盖模式 (targeted|balanced|full)')
  .option('--llm-gate', '将 LLM 发现纳入失败阈值判断')
  .action(handleScan);

/**
 * 执行扫描主流程，包括目标解析、扫描、报告输出与退出码处理
 * @param {string|undefined} target - 扫描目标路径（目录、文件或 zip 包）；未传入时使用当前工作目录
 * @param {ScanOptions} options - 命令行参数集合
 * @returns {Promise<void>} 无返回值；发生错误时会直接退出进程
 */
async function handleScan(target: string | undefined, options: ScanOptions): Promise<void> {
  console.log(chalk.blue('正在启动 Skill 安全扫描...'));

  let targetPath = target ? path.resolve(target) : process.cwd();
  let scanPath = targetPath;
  let isTemp = false;

  if (target && target.toLowerCase().endsWith('.zip')) {
    if (!fs.existsSync(targetPath)) {
      console.error(chalk.red(`错误: 在 ${targetPath} 未找到 zip 文件`));
      process.exit(1);
    }

    console.log(chalk.yellow(`检测到 ZIP 文件。正在解压...`));
    try {
      const zip = new AdmZip(targetPath);
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-scan-'));
      zip.extractAllTo(tempDir, true);
      scanPath = tempDir;
      isTemp = true;
      console.log(chalk.gray(`已解压至 ${tempDir}`));
    } catch (err) {
      console.error(chalk.red('解压 zip 文件时出错:'), err);
      process.exit(1);
    }
  } else if (target && !fs.existsSync(targetPath)) {
    console.error(chalk.red(`错误: 在 ${targetPath} 未找到目录`));
    process.exit(1);
  }

  const runner = new Runner(options.config);
  const configFromFile = loadCliConfig(options.config);
  const effectiveLlmGate = Boolean(options.llmGate ?? configFromFile.llm?.gate);
  const llmEnabledFromCli = Boolean(options.llm || options.useLlm);

  // 处理 listPresets 选项
  if (options.listPresets) {
    runner.listPresets();
    process.exit(0);
  }

  const overrides: Partial<SkillConfig> = pruneUndefined({
    useLlm: llmEnabledFromCli ? true : options.useLlm,
    preset: options.preset,
    rulesDir: options.rulesDir,
    enabledGroups: options.enableGroup && options.enableGroup.length > 0 ? options.enableGroup : undefined,
    disabledRuleIds: options.disableRule && options.disableRule.length > 0 ? options.disableRule : undefined,
    baselinePath: options.baseline,
    writeBaseline: options.writeBaseline,
    outputFormat: options.format ? normalizeFormat(options.format) : undefined,
    failOn: normalizeSeverity(options.failOn),
    llm: llmEnabledFromCli || options.llmProvider || options.llmBaseUrl || options.llmModel || options.llmMode || options.llmGate
      ? pruneUndefined({
          enabled: llmEnabledFromCli ? true : undefined,
          provider: normalizeLlmProvider(options.llmProvider),
          baseUrl: options.llmBaseUrl,
          model: options.llmModel,
          mode: normalizeLlmMode(options.llmMode),
          gate: options.llmGate
        })
      : undefined
  });

  try {
    const result = await runner.run(scanPath, overrides);

    console.log(chalk.green(`\n扫描完成，耗时 ${result.stats.durationMs}ms`));
    console.log(chalk.white(`扫描文件数: ${result.stats.filesScanned}`));
    console.log(chalk.white(`发现问题数: ${result.stats.issuesFound}\n`));

    if (result.vulnerabilities.length > 0) {
      console.log(chalk.red('检测到安全漏洞:'));
      result.vulnerabilities.forEach((v) => {
        printVulnerability(v);
      });
    } else {
      console.log(chalk.green('未发现安全漏洞。干得好！'));
    }

    const formatFromConfig = configFromFile.outputFormat;
    const effectiveFormat = options.format ? normalizeFormat(options.format) : (formatFromConfig ? normalizeFormat(formatFromConfig) : undefined);
    const outputPath = resolveOutputPath(options.output, effectiveFormat);
    if (outputPath) {
      const report = generateReport(result, effectiveFormat);
      fs.writeFileSync(outputPath, report);
      console.log(chalk.blue(`\n报告已保存至 ${outputPath}`));
    }

    if (isTemp) {
      try {
        fs.rmSync(scanPath, { recursive: true, force: true });
        console.log(chalk.gray(`已清理临时目录。`));
      } catch (cleanupErr) {
        console.warn(chalk.yellow(`警告: 无法清理临时目录 ${scanPath}`));
      }
    }

    if (shouldFail(result.vulnerabilities, options.failOn, effectiveLlmGate)) {
      process.exit(1);
    }
  } catch (err) {
    console.error(chalk.red('扫描过程中出错:'), err);
    if (isTemp) {
      fs.rmSync(scanPath, { recursive: true, force: true });
    }
    process.exit(1);
  }
}

// 将单条漏洞输出到控制台
/**
 * 以彩色文本形式输出单条漏洞信息
 * @param {Vulnerability} v - 漏洞对象，包含规则与定位信息
 * @returns {void} 无返回值
 */
function printVulnerability(v: Vulnerability): void {
  const color = v.severity === 'critical' ? chalk.bgRed : (v.severity === 'high' ? chalk.red : chalk.yellow);
  console.log(color(`[${v.severity.toUpperCase()}] ${v.ruleId}: ${v.description}`));
  console.log(chalk.gray(`  文件: ${v.file}:${v.line}`));
  console.log(chalk.gray(`  代码: ${v.codeSnippet}`));
  if (v.suggestion) {
    console.log(chalk.cyan(`  修复建议: ${v.suggestion}`));
  }
  console.log('');
}

// 根据格式输出 Markdown / JSON / SARIF 报告
/**
 * 生成扫描报告内容
 * @param {ScanResult} result - 扫描结果，包含统计信息与漏洞列表
 * @param {string} [format] - 输出格式，可选值 md|json|sarif，默认 md
 * @returns {string} 报告文本内容
 */
function generateReport(result: ScanResult, format?: string): string {
  const normalized = normalizeFormat(format);
  if (normalized === 'json') {
    return JSON.stringify({
      date: new Date().toISOString(),
      stats: result.stats,
      vulnerabilities: result.vulnerabilities,
      llm: result.llm
    }, null, 2);
  }
  if (normalized === 'sarif') {
    return JSON.stringify(buildSarif(result), null, 2);
  }
  let md = '# Skill 安全扫描报告\n\n';
  md += `日期: ${new Date().toLocaleString('zh-CN')}\n\n`;
  md += `扫描文件数: ${result.stats.filesScanned}\n\n`;
  if (result.llm && result.llm.findings.length > 0) {
    md += `大模型分析数: ${result.llm.findings.length}\n\n`;
  }
  if (result.vulnerabilities.length === 0) {
    md += '## ✅ 未发现安全漏洞。\n';
  } else {
    md += `## ⚠️ 发现 ${result.vulnerabilities.length} 个问题\n\n`;
    result.vulnerabilities.forEach(v => {
      md += `### [${v.severity.toUpperCase()}] ${v.ruleId}\n`;
      md += `**描述**: ${v.description}\n\n`;
      md += `**位置**: \`${v.file}:${v.line}\`\n\n`;
      md += `**代码**:\n\`\`\`\n${v.codeSnippet}\n\`\`\`\n\n`;
      md += `**修复建议**: ${v.suggestion}\n\n`;
      md += '---\n\n';
    });
  }

  if (result.llm && result.llm.findings.length > 0) {
    md += '## 🤖 大模型分析\n\n';
    result.llm.findings.forEach((f) => {
      md += `### [${f.severity.toUpperCase()}] ${f.title}\n`;
      md += `**类别**: ${f.category}\n\n`;
      md += `**置信度**: ${f.confidence}；**需人工复核**: ${f.needsReview ? '是' : '否'}\n\n`;
      md += `**位置**: \`${f.file}:${f.line ?? 0}\`\n\n`;
      if (f.evidence) {
        md += `**证据**:\n\`\`\`\n${f.evidence}\n\`\`\`\n\n`;
      }
      if (f.attackScenario) {
        md += `**利用方式**: ${f.attackScenario}\n\n`;
      }
      if (f.fix) {
        md += `**修复建议**: ${f.fix}\n\n`;
      }
      if (f.safeAlternative) {
        md += `**更安全替代**: ${f.safeAlternative}\n\n`;
      }
      md += '---\n\n';
    });
  }

  return md;
}

// 构造 SARIF 报告对象（兼容 GitHub 安全扫描）
/**
 * 构造 SARIF 结构对象
 * @param {ScanResult} result - 扫描结果
 * @returns {object} SARIF 兼容对象
 */
function buildSarif(result: ScanResult): object {
  const llmMap = new Map<string, { confidence?: string; needsReview?: boolean; category?: string; fix?: string; attackScenario?: string; provider?: string; model?: string; promptHash?: string }>();
  (result.llm?.findings ?? []).forEach((f) => {
    const ruleId = (f.relatedRuleIds && f.relatedRuleIds.length > 0) ? f.relatedRuleIds[0] : `LLM-DISC-${f.category.toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'UNKNOWN'}`;
    const key = `${ruleId}|${f.file}|${f.line ?? 0}`;
    llmMap.set(key, {
      confidence: f.confidence,
      needsReview: f.needsReview,
      category: f.category,
      fix: f.fix,
      attackScenario: f.attackScenario,
      provider: f.provider,
      model: f.model,
      promptHash: f.promptHash
    });
  });

  const ruleMap = new Map<string, { id: string; name: string; description: string }>();
  result.vulnerabilities.forEach((v) => {
    if (!ruleMap.has(v.ruleId)) {
      ruleMap.set(v.ruleId, { id: v.ruleId, name: v.ruleId, description: v.description });
    }
  });
  const rules = Array.from(ruleMap.values()).map((r) => ({
    id: r.id,
    name: r.name,
    shortDescription: { text: r.description }
  }));
  const results = result.vulnerabilities.map((v) => {
    const key = `${v.ruleId}|${v.file}|${v.line ?? 0}`;
    const llm = llmMap.get(key);
    return {
      ruleId: v.ruleId,
      level: mapSarifLevel(v.severity),
      message: { text: v.description },
      locations: [
        {
          physicalLocation: {
            artifactLocation: { uri: v.file },
            region: { startLine: v.line || 1 }
          }
        }
      ],
      properties: llm ? { llm } : undefined
    };
  });
  return {
    $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
    version: '2.1.0',
    runs: [
      {
        tool: {
          driver: {
            name: 'skill-scan',
            rules
          }
        },
        results
      }
    ]
  };
}

// 将内部严重级别映射为 SARIF 标准级别
/**
 * 映射内部严重级别到 SARIF 级别
 * @param {Severity} severity - 内部严重级别
 * @returns {string} SARIF 级别（error|warning|note）
 */
function mapSarifLevel(severity: Severity): string {
  if (severity === 'critical' || severity === 'high') {
    return 'error';
  }
  if (severity === 'medium') {
    return 'warning';
  }
  return 'note';
}

// 规范化报告格式，非法值默认回退为 md
/**
 * 规范化报告格式参数
 * @param {string} [format] - 原始格式字符串
 * @returns {'md'|'json'|'sarif'} 规范化后的格式
 */
function normalizeFormat(format?: string): 'md' | 'json' | 'sarif' {
  if (format === 'json' || format === 'sarif' || format === 'md') {
    return format;
  }
  return 'md';
}

/**
 * 规范化大模型 provider 参数
 * @param {string} [provider] - 原始 provider
 * @returns {LlmProvider|undefined} 规范化后的 provider
 */
function normalizeLlmProvider(provider?: string): LlmProvider | undefined {
  if (provider === 'openai' || provider === 'compatible' || provider === 'local') {
    return provider;
  }
  return undefined;
}

/**
 * 规范化大模型扫描模式参数
 * @param {string} [mode] - 原始 mode
 * @returns {LlmScanMode|undefined} 规范化后的 mode
 */
function normalizeLlmMode(mode?: string): LlmScanMode | undefined {
  if (mode === 'targeted' || mode === 'balanced' || mode === 'full') {
    return mode;
  }
  return undefined;
}

// 根据格式推断默认输出文件名
/**
 * 解析报告输出路径
 * @param {string} [output] - 显式输出路径
 * @param {string} [format] - 报告格式
 * @returns {string|undefined} 输出路径；未指定且无默认时返回 undefined
 */
function resolveOutputPath(output?: string, format?: string): string | undefined {
  if (output) {
    return output;
  }
  if (!format) {
    return undefined;
  }
  const normalized = normalizeFormat(format);
  if (normalized === 'json') {
    return 'report.json';
  }
  if (normalized === 'sarif') {
    return 'report.sarif';
  }
  return 'report.md';
}

// 支持重复参数（如 --enable-group 多次）
/**
 * 支持多次传入的命令行参数收集器
 * @param {string} value - 本次传入的参数值
 * @param {string[]} previous - 已收集的参数值
 * @returns {string[]} 合并后的参数值列表
 */
function collect(value: string, previous: string[]): string[] {
  return [...previous, value];
}

// 移除 undefined 字段，避免覆盖配置中的已有值
/**
 * 移除对象中的 undefined 字段，避免覆盖已有配置
 * @param {T} obj - 待清理的对象
 * @returns {Partial<T>} 清理后的对象
 */
function pruneUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const result: Partial<T> = {};
  Object.keys(obj).forEach((key) => {
    const value = obj[key as keyof T];
    if (value !== undefined) {
      result[key as keyof T] = value as T[keyof T];
    }
  });
  return result;
}

// 判断是否触发失败阈值，用于 CI 退出码
/**
 * 判断是否满足失败阈值
 * @param {Vulnerability[]} vulnerabilities - 漏洞列表
 * @param {string} [failOn] - 失败阈值（low|medium|high|critical）
 * @returns {boolean} 是否触发失败
 */
function shouldFail(vulnerabilities: Vulnerability[], failOn?: string, llmGate?: boolean): boolean {
  const threshold = normalizeSeverity(failOn);
  const selected = llmGate ? vulnerabilities : vulnerabilities.filter((v) => !v.ruleId.startsWith('LLM-DISC-'));
  if (!threshold) {
    return selected.length > 0;
  }
  const minRank = severityRank(threshold);
  return selected.some((v) => severityRank(v.severity) >= minRank);
}

/**
 * CLI 侧加载配置文件，用于推断默认输出格式与 gate 参数
 * @param {string | undefined} configPath - 配置文件路径
 * @returns {Partial<SkillConfig>} 解析得到的配置对象
 */
function loadCliConfig(configPath?: string): Partial<SkillConfig> {
  const resolvedPath = configPath ? path.resolve(configPath) : path.join(process.cwd(), 'skill-scan.config.json');
  try {
    if (!fs.existsSync(resolvedPath)) {
      return {};
    }
    const content = fs.readFileSync(resolvedPath, 'utf-8');
    return JSON.parse(content) as Partial<SkillConfig>;
  } catch {
    return {};
  }
}

// 规范化严重级别字符串
/**
 * 规范化严重级别字符串
 * @param {string} [level] - 原始级别字符串
 * @returns {Severity|undefined} 规范化后的级别；非法值返回 undefined
 */
function normalizeSeverity(level?: string): Severity | undefined {
  if (level === 'low' || level === 'medium' || level === 'high' || level === 'critical') {
    return level;
  }
  return undefined;
}

// 将严重级别转换为可比较的权重
/**
 * 将严重级别转换为可比较权重
 * @param {Severity} level - 严重级别
 * @returns {number} 权重值，数值越大级别越高
 */
function severityRank(level: Severity): number {
  if (level === 'low') {
    return 1;
  }
  if (level === 'medium') {
    return 2;
  }
  if (level === 'high') {
    return 3;
  }
  return 4;
}

program.parse(process.argv);
