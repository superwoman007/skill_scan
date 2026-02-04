import * as fs from 'fs';
import * as path from 'path';
import { SkillConfig } from '../types';

// 配置管理器：
// - 负责加载默认配置与用户配置文件（JSON）
// - 支持 CLI 覆盖配置，供 Runner 运行时使用
export class ConfigManager {
  private config: SkillConfig = {
    include: ['**/*.{js,ts,py,json}'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/test/**'],
    rules: [],
    outputFormat: 'md'
  };

  /**
   * 创建配置管理器并加载配置
   * @param {string} [configPath] - 用户指定配置文件路径；不传则尝试加载默认配置
   * @returns {void} 无返回值
   */
  constructor(configPath?: string) {
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
   * 加载配置文件并合并到默认配置
   * @param {string} filePath - 配置文件路径
   * @returns {void} 无返回值；读取失败时仅输出错误日志
   */
  private loadConfig(filePath: string): void {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const userConfig = JSON.parse(content);
      // 浅合并：用户配置覆盖默认值
      this.config = { ...this.config, ...userConfig };
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
    this.config = { ...this.config, ...overrides };
  }
}
