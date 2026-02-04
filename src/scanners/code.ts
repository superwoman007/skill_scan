import { BaseScanner } from './base';
import { Rule, Vulnerability } from '../types';

// 正则扫描器：
// - 仅处理 type=regex 的规则
// - 按行匹配正则并输出命中位置与代码片段
export class RegexScanner extends BaseScanner {
  /**
   * 创建正则扫描器，仅保留 regex 规则
   * @param {Rule[]} rules - 规则列表
   * @returns {void} 无返回值
   */
  constructor(rules: Rule[]) {
    super(rules.filter(r => r.type === 'regex'));
  }

  /**
   * 执行正则扫描
   * @param {string} filePath - 文件路径
   * @param {string} content - 文件内容
   * @returns {Promise<Vulnerability[]>} 漏洞列表
   */
  async scan(filePath: string, content: string): Promise<Vulnerability[]> {
    const vulnerabilities: Vulnerability[] = [];
    const lines = content.split('\n');

    for (const rule of this.rules) {
      if (!rule.pattern) continue;
      
      // 默认大小写不敏感，避免因关键字大小写导致漏报
      const regex = new RegExp(rule.pattern, 'i');

      lines.forEach((line, index) => {
        // 支持行级忽略（见 BaseScanner.shouldIgnoreLine）
        if (this.shouldIgnoreLine(line, rule.id)) {
          return;
        }
        if (regex.test(line)) {
          vulnerabilities.push(
            this.createVulnerability(
              rule,
              filePath,
              index + 1,
              line.trim()
            )
          );
        }
      });
    }

    return vulnerabilities;
  }
}
