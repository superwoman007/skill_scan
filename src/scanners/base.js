"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseScanner = void 0;
// 扫描器基类：
// - 统一保存规则列表
// - 提供创建漏洞对象与行级忽略逻辑
var BaseScanner = /** @class */ (function () {
    /**
     * 创建扫描器实例
     * @param {Rule[]} rules - 规则列表
     * @returns {void} 无返回值
     */
    function BaseScanner(rules) {
        this.rules = rules;
    }
    /**
     * 组装漏洞对象
     * @param {Rule} rule - 命中的规则
     * @param {string} file - 文件路径
     * @param {number} line - 命中行号
     * @param {string} codeSnippet - 命中代码片段
     * @returns {Vulnerability} 漏洞对象
     */
    BaseScanner.prototype.createVulnerability = function (rule, file, line, codeSnippet) {
        return {
            ruleId: rule.id,
            description: rule.description,
            severity: rule.severity,
            file: file,
            line: line,
            codeSnippet: codeSnippet,
            suggestion: rule.fix
        };
    };
    /**
     * 判断当前行是否被忽略
     * @param {string} line - 当前行文本
     * @param {string} ruleId - 规则 ID
     * @returns {boolean} 是否应忽略
     */
    BaseScanner.prototype.shouldIgnoreLine = function (line, ruleId) {
        if (!line) {
            return false;
        }
        var lower = line.toLowerCase();
        if (lower.includes('skill-scan-ignore')) {
            if (lower.includes('skill-scan-ignore:')) {
                return lower.includes("skill-scan-ignore:".concat(ruleId.toLowerCase()));
            }
            return true;
        }
        return false;
    };
    return BaseScanner;
}());
exports.BaseScanner = BaseScanner;
