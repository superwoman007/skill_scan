"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RuleLoader = void 0;
var fs = require("fs");
var path = require("path");
// 规则加载器：
// - 加载内置规则
// - 加载自定义规则文件
// - 加载规则目录中的多个规则文件
var RuleLoader = /** @class */ (function () {
    function RuleLoader() {
    }
    /**
     * 加载内置规则集合
     * @returns {Rule[]} 内置规则数组；失败时返回空数组
     */
    RuleLoader.loadBuiltinRules = function () {
        var rulesPath = path.join(__dirname, '../rules/security.json');
        try {
            var content = fs.readFileSync(rulesPath, 'utf-8');
            return JSON.parse(content);
        }
        catch (error) {
            console.error('Failed to load builtin rules:', error);
            return [];
        }
    };
    /**
     * 从规则目录加载多份 JSON 规则文件
     * @param {string} rulesDir - 规则目录路径
     * @returns {Rule[]} 合并后的规则数组；失败时返回空数组
     */
    RuleLoader.loadRulesFromDirectory = function (rulesDir) {
        try {
            if (!fs.existsSync(rulesDir)) {
                return [];
            }
            // 仅加载目录中的 JSON 规则文件
            var files = fs.readdirSync(rulesDir).filter(function (f) { return f.endsWith('.json'); });
            var allRules = [];
            for (var _i = 0, files_1 = files; _i < files_1.length; _i++) {
                var file = files_1[_i];
                var filePath = path.join(rulesDir, file);
                var content = fs.readFileSync(filePath, 'utf-8');
                var rules = JSON.parse(content);
                if (Array.isArray(rules)) {
                    allRules.push.apply(allRules, rules);
                }
            }
            return allRules;
        }
        catch (error) {
            console.error('Failed to load rules from directory:', error);
            return [];
        }
    };
    /**
     * 加载单个自定义规则文件
     * @param {string} rulesPath - 规则文件路径
     * @returns {Rule[]} 规则数组；失败时返回空数组
     */
    RuleLoader.loadCustomRules = function (rulesPath) {
        try {
            if (fs.existsSync(rulesPath)) {
                var content = fs.readFileSync(rulesPath, 'utf-8');
                return JSON.parse(content);
            }
        }
        catch (error) {
            console.error("Failed to load custom rules from ".concat(rulesPath, ":"), error);
        }
        return [];
    };
    return RuleLoader;
}());
exports.RuleLoader = RuleLoader;
