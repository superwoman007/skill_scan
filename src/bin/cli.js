#!/usr/bin/env node
"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
var commander_1 = require("commander");
var chalk_1 = require("chalk");
var fs = require("fs");
var path = require("path");
var os = require("os");
var adm_zip_1 = require("adm-zip");
var runner_1 = require("../core/runner");
// CLI 程序入口，负责参数解析、扫描调度、报告输出与退出码控制
var program = new commander_1.Command();
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
    .action(handleScan);
/**
 * 执行扫描主流程，包括目标解析、扫描、报告输出与退出码处理
 * @param {string|undefined} target - 扫描目标路径（目录、文件或 zip 包）；未传入时使用当前工作目录
 * @param {ScanOptions} options - 命令行参数集合
 * @returns {Promise<void>} 无返回值；发生错误时会直接退出进程
 */
function handleScan(target, options) {
    return __awaiter(this, void 0, void 0, function () {
        var targetPath, scanPath, isTemp, zip, tempDir, runner, overrides, result, outputPath, report, err_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log(chalk_1.default.blue('正在启动 Skill 安全扫描...'));
                    targetPath = target ? path.resolve(target) : process.cwd();
                    scanPath = targetPath;
                    isTemp = false;
                    if (target && target.toLowerCase().endsWith('.zip')) {
                        if (!fs.existsSync(targetPath)) {
                            console.error(chalk_1.default.red("\u9519\u8BEF: \u5728 ".concat(targetPath, " \u672A\u627E\u5230 zip \u6587\u4EF6")));
                            process.exit(1);
                        }
                        console.log(chalk_1.default.yellow("\u68C0\u6D4B\u5230 ZIP \u6587\u4EF6\u3002\u6B63\u5728\u89E3\u538B..."));
                        try {
                            zip = new adm_zip_1.default(targetPath);
                            tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-scan-'));
                            zip.extractAllTo(tempDir, true);
                            scanPath = tempDir;
                            isTemp = true;
                            console.log(chalk_1.default.gray("\u5DF2\u89E3\u538B\u81F3 ".concat(tempDir)));
                        }
                        catch (err) {
                            console.error(chalk_1.default.red('解压 zip 文件时出错:'), err);
                            process.exit(1);
                        }
                    }
                    else if (target && !fs.existsSync(targetPath)) {
                        console.error(chalk_1.default.red("\u9519\u8BEF: \u5728 ".concat(targetPath, " \u672A\u627E\u5230\u76EE\u5F55")));
                        process.exit(1);
                    }
                    runner = new runner_1.Runner(options.config);
                    overrides = pruneUndefined({
                        rulesDir: options.rulesDir,
                        enabledGroups: options.enableGroup && options.enableGroup.length > 0 ? options.enableGroup : undefined,
                        disabledRuleIds: options.disableRule && options.disableRule.length > 0 ? options.disableRule : undefined,
                        baselinePath: options.baseline,
                        writeBaseline: options.writeBaseline,
                        outputFormat: options.format ? normalizeFormat(options.format) : undefined,
                        failOn: normalizeSeverity(options.failOn)
                    });
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, runner.run(scanPath, overrides)];
                case 2:
                    result = _a.sent();
                    console.log(chalk_1.default.green("\n\u626B\u63CF\u5B8C\u6210\uFF0C\u8017\u65F6 ".concat(result.stats.durationMs, "ms")));
                    console.log(chalk_1.default.white("\u626B\u63CF\u6587\u4EF6\u6570: ".concat(result.stats.filesScanned)));
                    console.log(chalk_1.default.white("\u53D1\u73B0\u95EE\u9898\u6570: ".concat(result.stats.issuesFound, "\n")));
                    if (result.vulnerabilities.length > 0) {
                        console.log(chalk_1.default.red('检测到安全漏洞:'));
                        result.vulnerabilities.forEach(function (v) {
                            printVulnerability(v);
                        });
                    }
                    else {
                        console.log(chalk_1.default.green('未发现安全漏洞。干得好！'));
                    }
                    outputPath = resolveOutputPath(options.output, options.format);
                    if (outputPath) {
                        report = generateReport(result, options.format);
                        fs.writeFileSync(outputPath, report);
                        console.log(chalk_1.default.blue("\n\u62A5\u544A\u5DF2\u4FDD\u5B58\u81F3 ".concat(outputPath)));
                    }
                    if (isTemp) {
                        try {
                            fs.rmSync(scanPath, { recursive: true, force: true });
                            console.log(chalk_1.default.gray("\u5DF2\u6E05\u7406\u4E34\u65F6\u76EE\u5F55\u3002"));
                        }
                        catch (cleanupErr) {
                            console.warn(chalk_1.default.yellow("\u8B66\u544A: \u65E0\u6CD5\u6E05\u7406\u4E34\u65F6\u76EE\u5F55 ".concat(scanPath)));
                        }
                    }
                    if (shouldFail(result.vulnerabilities, options.failOn)) {
                        process.exit(1);
                    }
                    return [3 /*break*/, 4];
                case 3:
                    err_1 = _a.sent();
                    console.error(chalk_1.default.red('扫描过程中出错:'), err_1);
                    if (isTemp) {
                        fs.rmSync(scanPath, { recursive: true, force: true });
                    }
                    process.exit(1);
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    });
}
// 将单条漏洞输出到控制台
/**
 * 以彩色文本形式输出单条漏洞信息
 * @param {Vulnerability} v - 漏洞对象，包含规则与定位信息
 * @returns {void} 无返回值
 */
function printVulnerability(v) {
    var color = v.severity === 'critical' ? chalk_1.default.bgRed : (v.severity === 'high' ? chalk_1.default.red : chalk_1.default.yellow);
    console.log(color("[".concat(v.severity.toUpperCase(), "] ").concat(v.ruleId, ": ").concat(v.description)));
    console.log(chalk_1.default.gray("  \u6587\u4EF6: ".concat(v.file, ":").concat(v.line)));
    console.log(chalk_1.default.gray("  \u4EE3\u7801: ".concat(v.codeSnippet)));
    if (v.suggestion) {
        console.log(chalk_1.default.cyan("  \u4FEE\u590D\u5EFA\u8BAE: ".concat(v.suggestion)));
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
function generateReport(result, format) {
    var normalized = normalizeFormat(format);
    if (normalized === 'json') {
        return JSON.stringify({
            date: new Date().toISOString(),
            stats: result.stats,
            vulnerabilities: result.vulnerabilities
        }, null, 2);
    }
    if (normalized === 'sarif') {
        return JSON.stringify(buildSarif(result), null, 2);
    }
    var md = '# Skill 安全扫描报告\n\n';
    md += "\u65E5\u671F: ".concat(new Date().toLocaleString('zh-CN'), "\n\n");
    md += "\u626B\u63CF\u6587\u4EF6\u6570: ".concat(result.stats.filesScanned, "\n\n");
    if (result.vulnerabilities.length === 0) {
        md += '## ✅ 未发现安全漏洞。\n';
    }
    else {
        md += "## \u26A0\uFE0F \u53D1\u73B0 ".concat(result.vulnerabilities.length, " \u4E2A\u95EE\u9898\n\n");
        result.vulnerabilities.forEach(function (v) {
            md += "### [".concat(v.severity.toUpperCase(), "] ").concat(v.ruleId, "\n");
            md += "**\u63CF\u8FF0**: ".concat(v.description, "\n\n");
            md += "**\u4F4D\u7F6E**: `".concat(v.file, ":").concat(v.line, "`\n\n");
            md += "**\u4EE3\u7801**:\n```\n".concat(v.codeSnippet, "\n```\n\n");
            md += "**\u4FEE\u590D\u5EFA\u8BAE**: ".concat(v.suggestion, "\n\n");
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
function buildSarif(result) {
    var ruleMap = new Map();
    result.vulnerabilities.forEach(function (v) {
        if (!ruleMap.has(v.ruleId)) {
            ruleMap.set(v.ruleId, { id: v.ruleId, name: v.ruleId, description: v.description });
        }
    });
    var rules = Array.from(ruleMap.values()).map(function (r) { return ({
        id: r.id,
        name: r.name,
        shortDescription: { text: r.description }
    }); });
    var results = result.vulnerabilities.map(function (v) { return ({
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
        ]
    }); });
    return {
        $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
        version: '2.1.0',
        runs: [
            {
                tool: {
                    driver: {
                        name: 'skill-scan',
                        rules: rules
                    }
                },
                results: results
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
function mapSarifLevel(severity) {
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
function normalizeFormat(format) {
    if (format === 'json' || format === 'sarif' || format === 'md') {
        return format;
    }
    return 'md';
}
// 根据格式推断默认输出文件名
/**
 * 解析报告输出路径
 * @param {string} [output] - 显式输出路径
 * @param {string} [format] - 报告格式
 * @returns {string|undefined} 输出路径；未指定且无默认时返回 undefined
 */
function resolveOutputPath(output, format) {
    if (output) {
        return output;
    }
    if (!format) {
        return undefined;
    }
    var normalized = normalizeFormat(format);
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
function collect(value, previous) {
    return __spreadArray(__spreadArray([], previous, true), [value], false);
}
// 移除 undefined 字段，避免覆盖配置中的已有值
/**
 * 移除对象中的 undefined 字段，避免覆盖已有配置
 * @param {T} obj - 待清理的对象
 * @returns {Partial<T>} 清理后的对象
 */
function pruneUndefined(obj) {
    var result = {};
    Object.keys(obj).forEach(function (key) {
        var value = obj[key];
        if (value !== undefined) {
            result[key] = value;
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
function shouldFail(vulnerabilities, failOn) {
    var threshold = normalizeSeverity(failOn);
    if (!threshold) {
        return vulnerabilities.length > 0;
    }
    var minRank = severityRank(threshold);
    return vulnerabilities.some(function (v) { return severityRank(v.severity) >= minRank; });
}
// 规范化严重级别字符串
/**
 * 规范化严重级别字符串
 * @param {string} [level] - 原始级别字符串
 * @returns {Severity|undefined} 规范化后的级别；非法值返回 undefined
 */
function normalizeSeverity(level) {
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
function severityRank(level) {
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
