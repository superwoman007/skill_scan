"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfigManager = void 0;
var fs = require("fs");
var path = require("path");
// 配置管理器：
// - 负责加载默认配置与用户配置文件（JSON）
// - 支持 CLI 覆盖配置，供 Runner 运行时使用
// - 支持预设配置（strict/balanced/development等）
var ConfigManager = /** @class */ (function () {
    /**
     * 创建配置管理器并加载配置
     * @param {string} [configPath] - 用户指定配置文件路径；不传则尝试加载默认配置
     * @returns {void} 无返回值
     */
    function ConfigManager(configPath) {
        this.config = {
            include: ['**/*.{js,ts,py,json}'],
            exclude: ['**/node_modules/**', '**/dist/**', '**/test/**'],
            rules: [],
            outputFormat: 'md'
        };
        this.presets = {};
        this.loadPresets();
        if (configPath) {
            this.loadConfig(configPath);
        }
        else {
            var defaultPath = path.join(process.cwd(), 'skill-scan.config.json');
            if (fs.existsSync(defaultPath)) {
                this.loadConfig(defaultPath);
            }
        }
    }
    /**
     * 加载预设配置
     * @returns {void} 无返回值
     */
    ConfigManager.prototype.loadPresets = function () {
        try {
            var presetsPath = path.join(__dirname, '../../presets.json');
            if (fs.existsSync(presetsPath)) {
                var content = fs.readFileSync(presetsPath, 'utf-8');
                var data = JSON.parse(content);
                this.presets = data.presets || {};
            }
        }
        catch (error) {
            console.error('Error loading presets:', error);
        }
    };
    /**
     * 应用预设配置
     * @param {string} presetName - 预设配置名称
     * @returns {boolean} 是否成功应用
     */
    ConfigManager.prototype.applyPreset = function (presetName) {
        var preset = this.presets[presetName];
        if (!preset) {
            console.error("Preset not found: ".concat(presetName));
            console.log('Available presets:', Object.keys(this.presets).join(', '));
            return false;
        }
        console.log("Applying preset: ".concat(preset.name));
        console.log("  Description: ".concat(preset.description));
        if (preset.failOn) {
            this.config.failOn = preset.failOn;
        }
        if (preset.enabledGroups && preset.enabledGroups.includes('*')) {
            this.config.enabledGroups = undefined; // 启用所有规则组
            this.config.disabledRuleIds = preset.disabledRuleIds || [];
        }
        else {
            if (preset.enabledGroups) {
                this.config.enabledGroups = preset.enabledGroups;
            }
            if (preset.disabledRuleIds) {
                this.config.disabledRuleIds = preset.disabledRuleIds;
            }
        }
        return true;
    };
    /**
     * 列出可用预设配置
     * @returns {void} 无返回值
     */
    ConfigManager.prototype.listPresets = function () {
        console.log('Available presets:');
        console.log('');
        Object.entries(this.presets).forEach(function (_a) {
            var key = _a[0], preset = _a[1];
            console.log("  ".concat(key));
            console.log("    ".concat(preset.name));
            console.log("    ".concat(preset.description));
            console.log('');
        });
    };
    /**
     * 加载配置文件并合并到默认配置
     * @param {string} filePath - 配置文件路径
     * @returns {void} 无返回值；读取失败时仅输出错误日志
     */
    ConfigManager.prototype.loadConfig = function (filePath) {
        try {
            var content = fs.readFileSync(filePath, 'utf-8');
            var userConfig = JSON.parse(content);
            // 如果配置指定了预设，先应用预设
            if (userConfig.preset) {
                this.applyPreset(userConfig.preset);
            }
            // 浅合并：用户配置覆盖默认值
            this.config = __assign(__assign({}, this.config), userConfig);
        }
        catch (error) {
            console.error("Error loading config from ".concat(filePath, ":"), error);
        }
    };
    /**
     * 获取当前生效配置
     * @returns {SkillConfig} 合并后的配置对象
     */
    ConfigManager.prototype.getConfig = function () {
        return this.config;
    };
    /**
     * 合并 CLI 覆盖项到当前配置
     * @param {Partial<SkillConfig>} overrides - 需要覆盖的配置字段
     * @returns {void} 无返回值
     */
    ConfigManager.prototype.applyOverrides = function (overrides) {
        this.config = __assign(__assign({}, this.config), overrides);
    };
    return ConfigManager;
}());
exports.ConfigManager = ConfigManager;
