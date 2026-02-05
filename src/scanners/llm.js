"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.LLMScanner = void 0;
var base_1 = require("./base");
/**
 * LLM语义分析扫描器
 * 支持多种LLM提供商：OpenAI、智谱AI (GLM-4)等
 */
var LLMScanner = /** @class */ (function (_super) {
    __extends(LLMScanner, _super);
    function LLMScanner(rules, apiKey, model, baseURL) {
        var _this = _super.call(this, rules) || this;
        _this.apiKey = apiKey || process.env.SKILL_SCAN_LLM_API_KEY;
        _this.baseURL = baseURL || process.env.SKILL_SCAN_LLM_ENDPOINT || 'https://api.openai.com/v1/chat/completions';
        _this.model = model || process.env.SKILL_SCAN_LLM_MODEL || 'gpt-4o-mini';
        return _this;
    }
    /**
     * 使用LLM扫描文件内容
     */
    LLMScanner.prototype.scan = function (filePath, content) {
        return __awaiter(this, void 0, void 0, function () {
            var vulnerabilities, lines, chunkSize, i, chunkLines, chunkContent, startLine, chunkVulns, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.apiKey) {
                            console.warn('LLM Scanner: No API key provided, skipping LLM analysis');
                            console.warn('Set SKILL_SCAN_LLM_API_KEY environment variable or pass apiKey parameter');
                            return [2 /*return*/, []];
                        }
                        vulnerabilities = [];
                        lines = content.split('\n');
                        console.log("LLM Scanner: Using provider at ".concat(this.baseURL));
                        console.log("LLM Scanner: Using model ".concat(this.model));
                        chunkSize = 100;
                        i = 0;
                        _a.label = 1;
                    case 1:
                        if (!(i < lines.length)) return [3 /*break*/, 6];
                        chunkLines = lines.slice(i, i + chunkSize);
                        chunkContent = chunkLines.join('\n');
                        startLine = i + 1;
                        _a.label = 2;
                    case 2:
                        _a.trys.push([2, 4, , 5]);
                        return [4 /*yield*/, this.analyzeChunk(filePath, chunkContent, startLine, chunkLines)];
                    case 3:
                        chunkVulns = _a.sent();
                        vulnerabilities.push.apply(vulnerabilities, chunkVulns);
                        return [3 /*break*/, 5];
                    case 4:
                        error_1 = _a.sent();
                        console.error("LLM Scanner: Error analyzing chunk starting at line ".concat(startLine, ":"), error_1);
                        return [3 /*break*/, 5];
                    case 5:
                        i += chunkSize;
                        return [3 /*break*/, 1];
                    case 6: return [2 /*return*/, vulnerabilities];
                }
            });
        });
    };
    /**
     * 分析单个代码块
     */
    LLMScanner.prototype.analyzeChunk = function (filePath, content, startLine, lines) {
        return __awaiter(this, void 0, void 0, function () {
            var prompt, response, findings;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        prompt = this.buildAnalysisPrompt(content, this.rules);
                        return [4 /*yield*/, this.callLLM(prompt)];
                    case 1:
                        response = _a.sent();
                        findings = this.parseLLMResponse(response);
                        return [2 /*return*/, findings.map(function (finding) { return ({
                                ruleId: finding.ruleId,
                                description: finding.description,
                                severity: finding.severity,
                                file: filePath,
                                line: startLine + (finding.lineOffset || 0),
                                codeSnippet: _this.getCodeSnippet(lines, finding.lineOffset || 0),
                                suggestion: finding.suggestion,
                                confidence: finding.confidence || 0.7
                            }); })];
                }
            });
        });
    };
    /**
     * 构建分析提示词
     */
    LLMScanner.prototype.buildAnalysisPrompt = function (content, rules) {
        var rulesSummary = rules.map(function (r) {
            return "- ".concat(r.id, ": ").concat(r.name, " - ").concat(r.description);
        }).join('\n');
        return "You are a security expert analyzing code for vulnerabilities. Analyze the following code and identify any security issues.\n\nRules to check:\n".concat(rulesSummary, "\n\nCode to analyze:\n```\n").concat(content, "\n```\n\nRespond in JSON format:\n```json\n{\n  \"findings\": [\n    {\n      \"ruleId\": \"SEC-XXX\",\n      \"description\": \"Brief description of the issue\",\n      \"severity\": \"high|medium|low\",\n      \"lineOffset\": 0 (relative to the start of the chunk),\n      \"suggestion\": \"How to fix this\",\n      \"confidence\": 0.0-1.0\n    }\n  ]\n}\n```\n\nBe conservative - only report clear security issues. If no issues found, return {\"findings\": []}.");
    };
    /**
     * 调用LLM API
     */
    LLMScanner.prototype.callLLM = function (prompt) {
        return __awaiter(this, void 0, void 0, function () {
            var endpoint, response, data;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        endpoint = this.baseURL;
                        return [4 /*yield*/, fetch(endpoint, {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': "Bearer ".concat(this.apiKey)
                                },
                                body: JSON.stringify({
                                    model: this.model,
                                    messages: [
                                        {
                                            role: 'system',
                                            content: 'You are a security code analysis assistant. Always respond with valid JSON. Do not include any other text or explanations.'
                                        },
                                        {
                                            role: 'user',
                                            content: prompt
                                        }
                                    ],
                                    temperature: 0.3,
                                    stream: false
                                })
                            })];
                    case 1:
                        response = _a.sent();
                        if (!response.ok) {
                            throw new Error("LLM API error: ".concat(response.status, " ").concat(response.statusText));
                        }
                        return [4 /*yield*/, response.json()];
                    case 2:
                        data = _a.sent();
                        // 支持多种API响应格式
                        if (data.choices && data.choices[0]) {
                            return [2 /*return*/, data.choices[0].message.content];
                        }
                        else if (data.message && data.message.content) {
                            // 智谱API可能返回的格式
                            return [2 /*return*/, typeof data.message.content === 'string'
                                    ? data.message.content
                                    : JSON.stringify(data.message.content)];
                        }
                        else if (typeof data === 'string') {
                            // 直接返回字符串响应
                            return [2 /*return*/, data];
                        }
                        else {
                            console.error('Unexpected API response format:', JSON.stringify(data));
                            throw new Error('Unexpected API response format');
                        }
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * 解析LLM响应
     */
    LLMScanner.prototype.parseLLMResponse = function (response) {
        try {
            var parsed = JSON.parse(response);
            return parsed.findings || [];
        }
        catch (error) {
            console.error('LLM Scanner: Failed to parse LLM response', error);
            return [];
        }
    };
    /**
     * 获取代码片段
     */
    LLMScanner.prototype.getCodeSnippet = function (lines, offset, contextLines) {
        if (contextLines === void 0) { contextLines = 3; }
        var start = Math.max(0, offset - contextLines);
        var end = Math.min(lines.length, offset + contextLines + 1);
        return lines.slice(start, end).join('\n');
    };
    return LLMScanner;
}(base_1.BaseScanner));
exports.LLMScanner = LLMScanner;
