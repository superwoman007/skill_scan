import * as fs from 'fs';
import * as path from 'path';
import { Rule } from '../types';

// 规则加载器：
// - 加载内置规则
// - 加载自定义规则文件
// - 加载规则目录中的多个规则文件
export class RuleLoader {
  /**
   * 加载内置规则集合
   * @returns {Rule[]} 内置规则数组；失败时返回空数组
   */
  public static loadBuiltinRules(): Rule[] {
    const rulesPath = path.join(__dirname, '../rules/security.json');
    try {
      const content = fs.readFileSync(rulesPath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      console.error('Failed to load builtin rules:', error);
      return [];
    }
  }

  /**
   * 从规则目录加载多份 JSON 规则文件
   * @param {string} rulesDir - 规则目录路径
   * @returns {Rule[]} 合并后的规则数组；失败时返回空数组
   */
  public static loadRulesFromDirectory(rulesDir: string): Rule[] {
    try {
      if (!fs.existsSync(rulesDir)) {
        return [];
      }
      // 仅加载目录中的 JSON 规则文件
      const files = fs.readdirSync(rulesDir).filter((f) => f.endsWith('.json'));
      const allRules: Rule[] = [];
      for (const file of files) {
        const filePath = path.join(rulesDir, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        const rules = JSON.parse(content);
        if (Array.isArray(rules)) {
          allRules.push(...rules);
        }
      }
      return allRules;
    } catch (error) {
      console.error('Failed to load rules from directory:', error);
      return [];
    }
  }

  /**
   * 加载单个自定义规则文件
   * @param {string} rulesPath - 规则文件路径
   * @returns {Rule[]} 规则数组；失败时返回空数组
   */
  public static loadCustomRules(rulesPath: string): Rule[] {
    try {
      if (fs.existsSync(rulesPath)) {
        const content = fs.readFileSync(rulesPath, 'utf-8');
        return JSON.parse(content);
      }
    } catch (error) {
      console.error(`Failed to load custom rules from ${rulesPath}:`, error);
    }
    return [];
  }
}
