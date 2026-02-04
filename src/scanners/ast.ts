import { Project, SyntaxKind } from 'ts-morph';
import * as path from 'path';
import { BaseScanner } from './base';
import { Rule, Vulnerability } from '../types';

// AST 扫描器：
// - 使用 ts-morph 进行语法树遍历
// - 目前支持 call:xxx 的函数调用规则
type SelectorTarget = {
  rule: Rule;
  kind: 'call';
  target: string;
};

export class AstScanner extends BaseScanner {
  private selectors: SelectorTarget[];

  /**
   * 创建 AST 扫描器并预处理 selector
   * @param {Rule[]} rules - 规则列表
   * @returns {void} 无返回值
   */
  constructor(rules: Rule[]) {
    super(rules.filter((r) => r.type === 'ast'));
    this.selectors = this.rules
      .filter((r) => r.selector && r.selector.startsWith('call:'))
      .map((r) => ({
        rule: r,
        kind: 'call' as const,
        target: r.selector ? r.selector.replace('call:', '') : ''
      }))
      .filter((s) => s.target.length > 0);
  }

  /**
   * 执行 AST 扫描，定位函数调用表达式
   * @param {string} filePath - 文件路径
   * @param {string} content - 文件内容
   * @returns {Promise<Vulnerability[]>} 漏洞列表
   */
  async scan(filePath: string, content: string): Promise<Vulnerability[]> {
    const vulnerabilities: Vulnerability[] = [];
    if (this.selectors.length === 0) {
      return vulnerabilities;
    }
    if (!this.isSupportedFile(filePath)) {
      return vulnerabilities;
    }

    // 使用内存文件系统避免写入磁盘，提高扫描性能
    const project = new Project({
      useInMemoryFileSystem: true,
      compilerOptions: {
        allowJs: true
      }
    });

    const sourceFile = project.createSourceFile(filePath, content, { overwrite: true });
    const lines = content.split('\n');

    // 遍历所有调用表达式并匹配 selector
    const callExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);
    for (const callExpr of callExpressions) {
      const expressionText = callExpr.getExpression().getText();
      for (const selector of this.selectors) {
        if (!this.isCallMatch(expressionText, selector.target)) {
          continue;
        }
        const line = callExpr.getStartLineNumber();
        const lineText = lines[line - 1] || '';
        if (this.shouldIgnoreLine(lineText, selector.rule.id)) {
          continue;
        }
        vulnerabilities.push(
          this.createVulnerability(
            selector.rule,
            filePath,
            line,
            lineText.trim()
          )
        );
      }
    }

    return vulnerabilities;
  }

  /**
   * 判断文件是否支持 AST 解析
   * @param {string} filePath - 文件路径
   * @returns {boolean} 是否支持
   */
  private isSupportedFile(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return ext === '.ts' || ext === '.tsx' || ext === '.js' || ext === '.jsx';
  }

  /**
   * 判断调用表达式是否命中 selector
   * @param {string} expressionText - 调用表达式文本
   * @param {string} target - 目标函数名
   * @returns {boolean} 是否命中
   */
  private isCallMatch(expressionText: string, target: string): boolean {
    if (expressionText === target) {
      return true;
    }
    if (expressionText.endsWith(`.${target}`)) {
      return true;
    }
    return false;
  }
}
