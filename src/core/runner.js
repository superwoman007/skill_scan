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
exports.Runner = void 0;
var glob_1 = require("glob");
var fs = require("fs");
var config_1 = require("./config");
var rules_1 = require("./rules");
var code_1 = require("../scanners/code");
var ast_1 = require("../scanners/ast");
var llm_1 = require("../scanners/llm");
// 扫描调度器：
// - 读取配置与规则
// - 调用 Regex / AST 扫描器
// - 处理基线过滤与统计信息
var Runner = /** @class */ (function () {
    /**
     * 创建扫描调度器
     * @param {string} [configPath] - 配置文件路径；不传使用默认配置
     * @returns {void} 无返回值
     */
    function Runner(configPath) {
        this.configManager = new config_1.ConfigManager(configPath);
    }
    /**
     * 执行扫描流程
     * @param {string} [targetDir] - 扫描目标路径（目录或文件），默认当前工作目录
     * @param {Partial<SkillConfig>} [overrides] - CLI 覆盖配置项
     * @returns {Promise<ScanResult>} 扫描结果与统计信息
     */
    Runner.prototype.run = function () {
        return __awaiter(this, arguments, void 0, function (targetDir, overrides) {
            var startTime, config, rules, customRules, dirRules, regexScanner, astScanner, llmScanner, vulnerabilities, filesScanned, content, results, astResults, err_1, filteredVulnerabilities_1, _i, _a, pattern, files, _b, files_1, file, content, results, astResults, llmResults, err_2, filteredVulnerabilities;
            if (targetDir === void 0) { targetDir = process.cwd(); }
            if (overrides === void 0) { overrides = undefined; }
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        startTime = Date.now();
                        if (overrides) {
                            this.configManager.applyOverrides(overrides);
                        }
                        config = this.configManager.getConfig();
                        rules = rules_1.RuleLoader.loadBuiltinRules();
                        if (config.rules) {
                            rules = __spreadArray(__spreadArray([], rules, true), config.rules, true);
                        }
                        if (config.customRulesPath) {
                            customRules = rules_1.RuleLoader.loadCustomRules(config.customRulesPath);
                            rules = __spreadArray(__spreadArray([], rules, true), customRules, true);
                        }
                        if (config.rulesDir) {
                            dirRules = rules_1.RuleLoader.loadRulesFromDirectory(config.rulesDir);
                            rules = __spreadArray(__spreadArray([], rules, true), dirRules, true);
                        }
                        rules = this.filterRules(rules, config.enabledGroups, config.disabledRuleIds);
                        regexScanner = new code_1.RegexScanner(rules);
                        astScanner = new ast_1.AstScanner(rules);
                        llmScanner = new llm_1.LLMScanner(rules.filter(function (r) { return r.type === 'llm'; }), config.apiKey, config.llmModel);
                        vulnerabilities = [];
                        filesScanned = 0;
                        if (!(fs.existsSync(targetDir) && fs.statSync(targetDir).isFile())) return [3 /*break*/, 6];
                        _c.label = 1;
                    case 1:
                        _c.trys.push([1, 4, , 5]);
                        content = fs.readFileSync(targetDir, 'utf-8');
                        return [4 /*yield*/, regexScanner.scan(targetDir, content)];
                    case 2:
                        results = _c.sent();
                        return [4 /*yield*/, astScanner.scan(targetDir, content)];
                    case 3:
                        astResults = _c.sent();
                        vulnerabilities.push.apply(vulnerabilities, __spreadArray(__spreadArray([], results, false), astResults, false));
                        filesScanned = 1;
                        return [3 /*break*/, 5];
                    case 4:
                        err_1 = _c.sent();
                        console.error("Error scanning file ".concat(targetDir, ":"), err_1);
                        return [3 /*break*/, 5];
                    case 5:
                        filteredVulnerabilities_1 = this.applyBaselineFilter(vulnerabilities, config.baselinePath, config.writeBaseline);
                        return [2 /*return*/, {
                                vulnerabilities: filteredVulnerabilities_1,
                                stats: {
                                    filesScanned: filesScanned,
                                    issuesFound: filteredVulnerabilities_1.length,
                                    durationMs: Date.now() - startTime
                                }
                            }];
                    case 6:
                        _i = 0, _a = config.include || [];
                        _c.label = 7;
                    case 7:
                        if (!(_i < _a.length)) return [3 /*break*/, 18];
                        pattern = _a[_i];
                        return [4 /*yield*/, (0, glob_1.glob)(pattern, {
                                ignore: config.exclude,
                                nodir: true,
                                absolute: true,
                                cwd: targetDir
                            })];
                    case 8:
                        files = _c.sent();
                        _b = 0, files_1 = files;
                        _c.label = 9;
                    case 9:
                        if (!(_b < files_1.length)) return [3 /*break*/, 17];
                        file = files_1[_b];
                        filesScanned++;
                        _c.label = 10;
                    case 10:
                        _c.trys.push([10, 15, , 16]);
                        content = fs.readFileSync(file, 'utf-8');
                        return [4 /*yield*/, regexScanner.scan(file, content)];
                    case 11:
                        results = _c.sent();
                        return [4 /*yield*/, astScanner.scan(file, content)];
                    case 12:
                        astResults = _c.sent();
                        if (!(config.useLlm && config.apiKey)) return [3 /*break*/, 14];
                        return [4 /*yield*/, llmScanner.scan(file, content)];
                    case 13:
                        llmResults = _c.sent();
                        vulnerabilities.push.apply(vulnerabilities, llmResults);
                        _c.label = 14;
                    case 14:
                        vulnerabilities.push.apply(vulnerabilities, results);
                        vulnerabilities.push.apply(vulnerabilities, astResults);
                        return [3 /*break*/, 16];
                    case 15:
                        err_2 = _c.sent();
                        console.error("Error scanning file ".concat(file, ":"), err_2);
                        return [3 /*break*/, 16];
                    case 16:
                        _b++;
                        return [3 /*break*/, 9];
                    case 17:
                        _i++;
                        return [3 /*break*/, 7];
                    case 18:
                        filteredVulnerabilities = this.applyBaselineFilter(vulnerabilities, config.baselinePath, config.writeBaseline);
                        return [2 /*return*/, {
                                vulnerabilities: filteredVulnerabilities,
                                stats: {
                                    filesScanned: filesScanned,
                                    issuesFound: filteredVulnerabilities.length,
                                    durationMs: Date.now() - startTime
                                }
                            }];
                }
            });
        });
    };
    /**
     * 按分组与禁用列表过滤规则
     * @param {Rule[]} rules - 原始规则列表
     * @param {string[]} [enabledGroups] - 启用的规则分组；为空时不过滤
     * @param {string[]} [disabledRuleIds] - 禁用的规则 ID 列表
     * @returns {Rule[]} 过滤后的规则列表
     */
    Runner.prototype.filterRules = function (rules, enabledGroups, disabledRuleIds) {
        var filtered = rules;
        if (enabledGroups && enabledGroups.length > 0) {
            filtered = filtered.filter(function (r) { return r.group && enabledGroups.includes(r.group); });
        }
        if (disabledRuleIds && disabledRuleIds.length > 0) {
            filtered = filtered.filter(function (r) { return !disabledRuleIds.includes(r.id); });
        }
        return filtered;
    };
    /**
     * 基线过滤逻辑
     * @param {Vulnerability[]} vulnerabilities - 当前扫描的漏洞列表
     * @param {string} [baselinePath] - 基线文件路径
     * @param {boolean} [writeBaseline] - 是否写入当前漏洞为基线
     * @returns {Vulnerability[]} 过滤后的漏洞列表
     */
    Runner.prototype.applyBaselineFilter = function (vulnerabilities, baselinePath, writeBaseline) {
        var _this = this;
        if (!baselinePath) {
            return vulnerabilities;
        }
        var currentKeys = vulnerabilities.map(function (v) { return _this.signatureKey(v); });
        if (writeBaseline) {
            this.writeBaseline(baselinePath, currentKeys);
            return [];
        }
        var baselineKeys = this.readBaseline(baselinePath);
        if (baselineKeys.length === 0) {
            return vulnerabilities;
        }
        return vulnerabilities.filter(function (v) { return !baselineKeys.includes(_this.signatureKey(v)); });
    };
    /**
     * 生成漏洞稳定签名用于基线比对
     * @param {Vulnerability} v - 漏洞对象
     * @returns {string} 签名字符串
     */
    Runner.prototype.signatureKey = function (v) {
        var _a, _b;
        var line = (_a = v.line) !== null && _a !== void 0 ? _a : 0;
        return "".concat(v.ruleId, "|").concat(v.file, "|").concat(line, "|").concat((_b = v.codeSnippet) !== null && _b !== void 0 ? _b : '');
    };
    /**
     * 读取基线文件
     * @param {string} filePath - 基线文件路径
     * @returns {string[]} 签名列表；读取失败返回空数组
     */
    Runner.prototype.readBaseline = function (filePath) {
        try {
            if (!fs.existsSync(filePath)) {
                return [];
            }
            var content = fs.readFileSync(filePath, 'utf-8');
            var parsed = JSON.parse(content);
            if (Array.isArray(parsed)) {
                return parsed;
            }
            if (parsed && Array.isArray(parsed.items)) {
                return parsed.items;
            }
            return [];
        }
        catch (_a) {
            return [];
        }
    };
    /**
     * 写入基线文件
     * @param {string} filePath - 基线文件路径
     * @param {string[]} items - 漏洞签名列表
     * @returns {void} 无返回值
     */
    Runner.prototype.writeBaseline = function (filePath, items) {
        try {
            fs.writeFileSync(filePath, JSON.stringify({ items: items }, null, 2));
        }
        catch (err) {
            console.error("Error writing baseline to ".concat(filePath, ":"), err);
        }
    };
    return Runner;
}());
exports.Runner = Runner;
