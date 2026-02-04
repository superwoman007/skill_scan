import { Rule, Vulnerability } from '../types';

// 扫描器基类：
// - 统一保存规则列表
// - 提供创建漏洞对象与行级忽略逻辑
export abstract class BaseScanner {
  protected rules: Rule[];

  /**
   * 创建扫描器实例
   * @param {Rule[]} rules - 规则列表
   * @returns {void} 无返回值
   */
  constructor(rules: Rule[]) {
    this.rules = rules;
  }

  /**
   * 扫描指定文件内容
   * @param {string} filePath - 文件路径
   * @param {string} content - 文件内容
   * @returns {Promise<Vulnerability[]>} 漏洞列表
   */
  abstract scan(filePath: string, content: string): Promise<Vulnerability[]>;

  /**
   * 组装漏洞对象
   * @param {Rule} rule - 命中的规则
   * @param {string} file - 文件路径
   * @param {number} line - 命中行号
   * @param {string} codeSnippet - 命中代码片段
   * @returns {Vulnerability} 漏洞对象
   */
  protected createVulnerability(
    rule: Rule,
    file: string,
    line: number,
    codeSnippet: string
  ): Vulnerability {
    return {
      ruleId: rule.id,
      description: rule.description,
      severity: rule.severity,
      file,
      line,
      codeSnippet,
      suggestion: rule.fix
    };
  }

  /**
   * 判断当前行是否被忽略
   * @param {string} line - 当前行文本
   * @param {string} ruleId - 规则 ID
   * @returns {boolean} 是否应忽略
   */
  protected shouldIgnoreLine(line: string, ruleId: string): boolean {
    if (!line) {
      return false;
    }
    const lower = line.toLowerCase();
    if (lower.includes('skill-scan-ignore')) {
      if (lower.includes('skill-scan-ignore:')) {
        return lower.includes(`skill-scan-ignore:${ruleId.toLowerCase()}`);
      }
      return true;
    }
    return false;
  }
}
