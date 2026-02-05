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
exports.AstScanner = void 0;
var ts_morph_1 = require("ts-morph");
var path = require("path");
var base_1 = require("./base");
var AstScanner = /** @class */ (function (_super) {
    __extends(AstScanner, _super);
    /**
     * 创建 AST 扫描器并预处理 selector
     * @param {Rule[]} rules - 规则列表
     * @returns {void} 无返回值
     */
    function AstScanner(rules) {
        var _this = _super.call(this, rules.filter(function (r) { return r.type === 'ast'; })) || this;
        _this.selectors = _this.rules
            .filter(function (r) { return r.selector && r.selector.startsWith('call:'); })
            .map(function (r) { return ({
            rule: r,
            kind: 'call',
            target: r.selector ? r.selector.replace('call:', '') : ''
        }); })
            .filter(function (s) { return s.target.length > 0; });
        return _this;
    }
    /**
     * 执行 AST 扫描，定位函数调用表达式
     * @param {string} filePath - 文件路径
     * @param {string} content - 文件内容
     * @returns {Promise<Vulnerability[]>} 漏洞列表
     */
    AstScanner.prototype.scan = function (filePath, content) {
        return __awaiter(this, void 0, void 0, function () {
            var vulnerabilities, project, sourceFile, lines, callExpressions, _i, callExpressions_1, callExpr, expressionText, _a, _b, selector, line, lineText;
            return __generator(this, function (_c) {
                vulnerabilities = [];
                if (this.selectors.length === 0) {
                    return [2 /*return*/, vulnerabilities];
                }
                if (!this.isSupportedFile(filePath)) {
                    return [2 /*return*/, vulnerabilities];
                }
                project = new ts_morph_1.Project({
                    useInMemoryFileSystem: true,
                    compilerOptions: {
                        allowJs: true
                    }
                });
                sourceFile = project.createSourceFile(filePath, content, { overwrite: true });
                lines = content.split('\n');
                callExpressions = sourceFile.getDescendantsOfKind(ts_morph_1.SyntaxKind.CallExpression);
                for (_i = 0, callExpressions_1 = callExpressions; _i < callExpressions_1.length; _i++) {
                    callExpr = callExpressions_1[_i];
                    expressionText = callExpr.getExpression().getText();
                    for (_a = 0, _b = this.selectors; _a < _b.length; _a++) {
                        selector = _b[_a];
                        if (!this.isCallMatch(expressionText, selector.target)) {
                            continue;
                        }
                        line = callExpr.getStartLineNumber();
                        lineText = lines[line - 1] || '';
                        if (this.shouldIgnoreLine(lineText, selector.rule.id)) {
                            continue;
                        }
                        vulnerabilities.push(this.createVulnerability(selector.rule, filePath, line, lineText.trim()));
                    }
                }
                return [2 /*return*/, vulnerabilities];
            });
        });
    };
    /**
     * 判断文件是否支持 AST 解析
     * @param {string} filePath - 文件路径
     * @returns {boolean} 是否支持
     */
    AstScanner.prototype.isSupportedFile = function (filePath) {
        var ext = path.extname(filePath).toLowerCase();
        return ext === '.ts' || ext === '.tsx' || ext === '.js' || ext === '.jsx';
    };
    /**
     * 判断调用表达式是否命中 selector
     * @param {string} expressionText - 调用表达式文本
     * @param {string} target - 目标函数名
     * @returns {boolean} 是否命中
     */
    AstScanner.prototype.isCallMatch = function (expressionText, target) {
        if (expressionText === target) {
            return true;
        }
        if (expressionText.endsWith(".".concat(target))) {
            return true;
        }
        return false;
    };
    return AstScanner;
}(base_1.BaseScanner));
exports.AstScanner = AstScanner;
