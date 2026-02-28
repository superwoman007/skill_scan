import * as fs from 'fs';
import * as path from 'path';
import { SkillConfig } from '../types';

interface PresetConfig {
  name: string;
  description: string;
  failOn?: 'low' | 'medium' | 'high' | 'critical';
  enabledGroups?: string[];
  disabledRuleIds?: string[];
}

interface Presets {
  [key: string]: PresetConfig;
}

// 配置管理器：
// - 负责加载默认配置与用户配置文件（JSON）
// - 支持 CLI 覆盖配置，供 Runner 运行时使用
// - 支持预设配置（strict/balanced/development等）
export class ConfigManager {
  private config: SkillConfig = {
    include: ['**/*.{js,ts,py,json}'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/test/**'],
    rules: [],
    outputFormat: 'md',
    llm: {
      enabled: false,
      provider: 'compatible',
      mode: 'targeted',
      apiKeyEnv: 'SKILL_SCAN_LLM_API_KEY',
      timeoutMs: 30000,
      maxConcurrency: 2,
      includeEvidenceLines: 8,
      gate: false,
      cache: {
        enabled: false,
        dir: '.skill-scan-cache'
      },
      redact: {
        enabled: true
      }
    }
  };
  private presets: Presets = {};

  /**
   * 创建配置管理器并加载配置
   * @param {string} [configPath] - 用户指定配置文件路径；不传则尝试加载默认配置
   * @returns {void} 无返回值
   */
  constructor(configPath?: string) {
    this.loadPresets();
    if (configPath) {
      this.loadConfig(configPath);
    } else {
      const defaultPath = path.join(process.cwd(), 'skill-scan.config.json');
      if (fs.existsSync(defaultPath)) {
        this.loadConfig(defaultPath);
      }
    }
  }

  /**
   * 加载预设配置
   * @returns {void} 无返回值
   */
  private loadPresets(): void {
    try {
      const presetsPath = path.join(__dirname, '../../presets.json');
      if (fs.existsSync(presetsPath)) {
        const content = fs.readFileSync(presetsPath, 'utf-8');
        const data = JSON.parse(content);
        this.presets = data.presets || {};
      }
    } catch (error) {
      console.error('Error loading presets:', error);
    }
  }

  /**
   * 应用预设配置
   * @param {string} presetName - 预设配置名称
   * @returns {boolean} 是否成功应用
   */
  public applyPreset(presetName: string): boolean {
    const preset = this.presets[presetName];
    if (!preset) {
      console.error(`Preset not found: ${presetName}`);
      console.log('Available presets:', Object.keys(this.presets).join(', '));
      return false;
    }

    console.log(`Applying preset: ${preset.name}`);
    console.log(`  Description: ${preset.description}`);

    if (preset.failOn) {
      this.config.failOn = preset.failOn;
    }

    if (preset.enabledGroups && preset.enabledGroups.includes('*')) {
      this.config.enabledGroups = undefined; // 启用所有规则组
      this.config.disabledRuleIds = preset.disabledRuleIds || [];
    } else {
      if (preset.enabledGroups) {
        this.config.enabledGroups = preset.enabledGroups;
      }
      if (preset.disabledRuleIds) {
        this.config.disabledRuleIds = preset.disabledRuleIds;
      }
    }

    return true;
  }

  /**
   * 列出可用预设配置
   * @returns {void} 无返回值
   */
  public listPresets(): void {
    console.log('Available presets:');
    console.log('');
    Object.entries(this.presets).forEach(([key, preset]) => {
      console.log(`  ${key}`);
      console.log(`    ${preset.name}`);
      console.log(`    ${preset.description}`);
      console.log('');
    });
  }

  /**
   * 加载配置文件并合并到默认配置
   * @param {string} filePath - 配置文件路径
   * @returns {void} 无返回值；读取失败时仅输出错误日志
   */
  private loadConfig(filePath: string): void {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const userConfig = JSON.parse(content);
      // 如果配置指定了预设，先应用预设
      if (userConfig.preset) {
        this.applyPreset(userConfig.preset);
      }

      // 浅合并为主；对 llm 采用一层合并以降低配置成本
      this.config = {
        ...this.config,
        ...userConfig,
        llm: {
          ...this.config.llm,
          ...userConfig.llm,
          cache: { ...this.config.llm?.cache, ...userConfig.llm?.cache },
          redact: { ...this.config.llm?.redact, ...userConfig.llm?.redact }
        }
      };
    } catch (error) {
      console.error(`Error loading config from ${filePath}:`, error);
    }
  }

  /**
   * 获取当前生效配置
   * @returns {SkillConfig} 合并后的配置对象
   */
  public getConfig(): SkillConfig {
    return this.config;
  }

  /**
   * 合并 CLI 覆盖项到当前配置
   * @param {Partial<SkillConfig>} overrides - 需要覆盖的配置字段
   * @returns {void} 无返回值
   */
  public applyOverrides(overrides: Partial<SkillConfig>): void {
    // 如果指定了预设，先应用预设
    if (overrides.preset) {
      this.applyPreset(overrides.preset);
    }

    // 合并其他配置字段（不包括 preset）
    const { preset, ...otherOverrides } = overrides;
    this.config = {
      ...this.config,
      ...otherOverrides,
      llm: otherOverrides.llm
        ? {
            ...this.config.llm,
            ...otherOverrides.llm,
            cache: { ...this.config.llm?.cache, ...otherOverrides.llm?.cache },
            redact: { ...this.config.llm?.redact, ...otherOverrides.llm?.redact }
          }
        : this.config.llm
    };
  }
}
