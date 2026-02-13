# Skill Scan

<p align="right">
  <a href="#简体中文"><img alt="简体中文" src="https://img.shields.io/badge/简体中文-阅读-blue"></a>
  <a href="#english"><img alt="English" src="https://img.shields.io/badge/English-Read-green"></a>
</p>

## 简体中文

Skill Scan 是一个面向技能（Skill）项目的安全扫描工具，支持正则与 AST 检测、规则分组、基线管理、JSON/SARIF 报告输出，并可集成到 CI/CD 流水线中。

### 功能特性
- 正则与 AST 双引擎扫描（JS/TS 语法级调用识别）
- 行级忽略与基线误报管理
- 规则分组启停与规则目录加载
- Markdown / JSON / SARIF 报告输出
- 支持扫描目录、文件与 zip 包

### 技术架构
#### 架构概览
- CLI 层：命令行参数解析、报告输出、退出码控制
- 配置层：读取配置文件与命令行覆盖配置
- 规则层：内置规则 + 自定义规则 + 规则目录加载
- 扫描层：正则扫描 + AST 扫描
- 输出层：Markdown / JSON / SARIF

#### 目录结构
```
src/
  bin/cli.ts        CLI 与报告输出
  core/config.ts    配置加载与覆盖
  core/rules.ts     规则加载（内置/自定义/目录）
  core/runner.ts    扫描调度与基线过滤
  scanners/         正则与 AST 扫描实现
  types/            类型定义
src/rules/          内置规则库
```

### 已实现功能
- AST 调用检测（call:eval、call:exec、call:execSync、call:spawn）
- 行级忽略机制（skill-scan-ignore 与 skill-scan-ignore:规则ID）
- 基线写入与过滤（baseline 文件）
- 规则分组与按组启用/禁用
- 规则目录加载（多 JSON 文件）
- JSON/SARIF 报告输出
- CLI 失败阈值（fail-on）与退出码控制

### 安装与构建
```bash
npm install
npm run build
```

### 快速使用
```bash
npm run scan -- .
npm run scan -- path/to/project
npm run scan -- path/to/skill.zip
```

### 报告输出
```bash
npm run scan -- . --output report.md
npm run scan -- . --format json --output report.json
npm run scan -- . --format sarif --output report.sarif
```

### 规则与分组
```bash
npm run scan -- . --rules-dir ./rules
npm run scan -- . --enable-group owasp-top10 --disable-rule SEC-002
```

### 基线与阈值
```bash
npm run scan -- . --baseline .skill-scan.baseline.json --write-baseline
npm run scan -- . --baseline .skill-scan.baseline.json
npm run scan -- . --fail-on high
```

### CLI 参数
- -c, --config <path> 配置文件路径
- -o, --output <path> 保存报告路径
- -f, --format <format> 报告格式 (md|json|sarif)
- --rules-dir <path> 规则目录路径
- --enable-group <group> 启用规则分组（可多次）
- --disable-rule <id> 禁用规则 ID（可多次）
- --baseline <path> 基线文件路径
- --write-baseline 写入当前结果为基线
- --fail-on <level> 失败阈值 (low|medium|high|critical)
- --use-llm 启用 LLM 语义分析
- --analyze-intent 启用 LLM 意图分析（XGPT 风格）

### 配置文件示例
创建 `skill-scan.config.json`：
```json
{
  "include": ["**/*.{js,ts,py,json}"],
  "exclude": ["**/node_modules/**", "**/dist/**", "**/test/**"],
  "rulesDir": "./rules",
  "enabledGroups": ["owasp-top10"],
  "disabledRuleIds": ["SEC-002"],
  "baselinePath": ".skill-scan.baseline.json",
  "outputFormat": "md",
  "failOn": "high",
  "useLLM": true,
  "analyzeIntent": true
}
```

使用配置文件：
```bash
npm run scan -- . -c ./skill-scan.config.json
```

### LLM 语义分析

启用 LLM 深度语义分析：
```bash
npm run scan -- . --use-llm
```

启用 XGPT 风格的意图分析：
```bash
npm run scan -- . --analyze-intent
```

组合使用：
```bash
npm run scan -- . --use-llm --analyze-intent --format json --output report.json
```

**环境变量配置**（使用 Clawdbot 的火山引擎配置）：
```bash
export SKILL_SCAN_LLM_API_KEY="your-api-key"
export SKILL_SCAN_LLM_ENDPOINT="https://ark.cn-beijing.volces.com/api/coding/v3/chat/completions"
export SKILL_SCAN_LLM_MODEL="glm-4.7"
```

### 规则格式
规则为 JSON 数组，示例：
```json
[
  {
    "id": "SEC-101",
    "name": "Eval 调用检测",
    "description": "检测到对 eval 的直接调用。",
    "severity": "critical",
    "type": "ast",
    "selector": "call:eval",
    "fix": "避免使用 eval 进行动态执行。",
    "tags": ["security", "code"],
    "group": "owasp-top10"
  }
]
```

### CI 集成

#### GitHub Actions
```yaml
name: skill-scan
on:
  pull_request:
  push:
    branches: [ "main" ]
jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm run scan -- . --format sarif --output report.sarif --fail-on high
      - uses: github/codeql-action/upload-sarif@v3
        with:
          sarif_file: report.sarif
```

#### GitLab CI
```yaml
stages:
  - scan

skill_scan:
  stage: scan
  image: node:20
  script:
    - npm ci
    - npm run scan -- . --format json --output report.json --fail-on high
  artifacts:
    paths:
      - report.json
```

## English

Skill Scan is a security scanning tool for Skill projects. It supports both regex and AST-based detection, rule grouping, baseline management, JSON/SARIF report output, and CI/CD integration.

### Features
- Dual-engine scanning (regex + AST), with JS/TS syntax-level call detection
- Line-level ignore and baseline-based false-positive management
- Enable/disable rule groups and load rules from a directory
- Output reports in Markdown / JSON / SARIF
- Scan directories, files, and zip archives

### Architecture
#### Overview
- CLI layer: argument parsing, report output, exit code control
- Config layer: load config file and apply CLI overrides
- Rules layer: built-in rules + custom rules + directory loading
- Scanning layer: regex scanning + AST scanning
- Output layer: Markdown / JSON / SARIF

#### Project Layout
```
src/
  bin/cli.ts        CLI and report output
  core/config.ts    Config loading and overrides
  core/rules.ts     Rule loading (built-in/custom/directory)
  core/runner.ts    Scan orchestration and baseline filtering
  scanners/         Regex and AST scanner implementations
  types/            Type definitions
src/rules/          Built-in rule library
```

### Implemented
- AST call detection (call:eval, call:exec, call:execSync, call:spawn)
- Line-level ignore markers (skill-scan-ignore and skill-scan-ignore:<ruleId>)
- Baseline writing and filtering
- Rule grouping with per-group enable/disable
- Load multiple JSON rule files from a rules directory
- JSON/SARIF report output
- Failure threshold (fail-on) and exit code control

### Install & Build
```bash
npm install
npm run build
```

### Quick Start
```bash
npm run scan -- .
npm run scan -- path/to/project
npm run scan -- path/to/skill.zip
```

### Report Output
```bash
npm run scan -- . --output report.md
npm run scan -- . --format json --output report.json
npm run scan -- . --format sarif --output report.sarif
```

### Rules & Groups
```bash
npm run scan -- . --rules-dir ./rules
npm run scan -- . --enable-group owasp-top10 --disable-rule SEC-002
```

### Baseline & Threshold
```bash
npm run scan -- . --baseline .skill-scan.baseline.json --write-baseline
npm run scan -- . --baseline .skill-scan.baseline.json
npm run scan -- . --fail-on high
```

### CLI Options
- -c, --config <path> Config file path
- -o, --output <path> Output report path
- -f, --format <format> Report format (md|json|sarif)
- --rules-dir <path> Rules directory path
- --enable-group <group> Enable rule group (repeatable)
- --disable-rule <id> Disable rule ID (repeatable)
- --baseline <path> Baseline file path
- --write-baseline Write current results as baseline
- --fail-on <level> Failure threshold (low|medium|high|critical)
- --use-llm Enable LLM semantic analysis
- --analyze-intent Enable LLM intent analysis (XGPT style)

### Config Example
Create `skill-scan.config.json`:
```json
{
  "include": ["**/*.{js,ts,py,json}"],
  "exclude": ["**/node_modules/**", "**/dist/**", "**/test/**"],
  "rulesDir": "./rules",
  "enabledGroups": ["owasp-top10"],
  "disabledRuleIds": ["SEC-002"],
  "baselinePath": ".skill-scan.baseline.json",
  "outputFormat": "md",
  "failOn": "high",
  "useLLM": true,
  "analyzeIntent": true
}
```

Use the config file:
```bash
npm run scan -- . -c ./skill-scan.config.json
```

### LLM Semantic Analysis

Enable LLM deep semantic analysis:
```bash
npm run scan -- . --use-llm
```

Enable XGPT-style intent analysis:
```bash
npm run scan -- . --analyze-intent
```

Combine both:
```bash
npm run scan -- . --use-llm --analyze-intent --format json --output report.json
```

**Environment Variables** (use Clawdbot's VolcEngine config):
```bash
export SKILL_SCAN_LLM_API_KEY="your-api-key"
export SKILL_SCAN_LLM_ENDPOINT="https://ark.cn-beijing.volces.com/api/coding/v3/chat/completions"
export SKILL_SCAN_LLM_MODEL="glm-4.7"
```

### Rule Format
Rules are a JSON array. Example:
```json
[
  {
    "id": "SEC-101",
    "name": "Eval Call Detection",
    "description": "Detects direct calls to eval.",
    "severity": "critical",
    "type": "ast",
    "selector": "call:eval",
    "fix": "Avoid using eval for dynamic execution.",
    "tags": ["security", "code"],
    "group": "owasp-top10"
  }
]
```

### CI Integration

#### GitHub Actions
```yaml
name: skill-scan
on:
  pull_request:
  push:
    branches: [ "main" ]
jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm run scan -- . --format sarif --output report.sarif --fail-on high
      - uses: github/codeql-action/upload-sarif@v3
        with:
          sarif_file: report.sarif
```

#### GitLab CI
```yaml
stages:
  - scan

skill_scan:
  stage: scan
  image: node:20
  script:
    - npm ci
    - npm run scan -- . --format json --output report.json --fail-on high
  artifacts:
    paths:
      - report.json
```
