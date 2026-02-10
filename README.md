# Skill Scan

<p align="right">
  <a href="#简体中文"><img alt="简体中文" src="https://img.shields.io/badge/简体中文-阅读-blue"></a>
  <a href="#english"><img alt="English" src="https://img.shields.io/badge/English-Read-green"></a>
</p>

## 简体中文

Skill Scan 是一个面向技能（Skill）项目的安全扫描工具，支持正则与 AST 检测、**LLM 语义分析**、规则分组、基线管理、JSON/SARIF 报告输出，并可集成到 CI/CD 流水线中。

### 功能特性

- **多引擎扫描**: 正则 + AST + **LLM 语义分析**
- 行级忽略与基线误报管理
- 规则分组启停与规则目录加载
- **预设配置**: strict / balanced / development / ai-focused
- Markdown / JSON / SARIF 报告输出
- 支持扫描目录、文件与 zip 包

### 技术架构

#### 架构概览
- CLI 层：命令行参数解析、报告输出、退出码控制
- 配置层：读取配置文件与命令行覆盖配置 + **预设配置**
- 规则层：内置规则 + 自定义规则 + 规则目录加载 + **AI 安全规则**
- 扫描层：正则扫描 + AST 扫描 + **LLM 语义扫描**
- 输出层：Markdown / JSON / SARIF

#### 目录结构
```
src/
  bin/cli.ts        CLI 与报告输出
  core/config.ts    配置加载与覆盖 + 预设管理
  core/rules.ts     规则加载（内置/自定义/目录）
  core/runner.ts    扫描调度与基线过滤
  scanners/         正则 + AST + LLM 扫描实现
  types/            类型定义
src/rules/          内置规则库（包含 AI 安全规则）
presets.json       预设配置模板
```

### 新增功能 (v2.0+)

#### 🧠 LLM 语义分析

使用 GPT-4o-mini 等模型进行代码语义分析，检测：
- 复杂的安全漏洞模式
- 上下文相关的安全问题
- 正则和 AST 难以捕获的漏洞

**启用方式：**
```bash
export SKILL_SCAN_LLM_API_KEY="your-api-key"

# 注意：--llm-base-url 需要填写“完整端点”，且必须以 /chat/completions 结尾

# OpenAI 示例
npm run scan -- . \
  --llm \
  --llm-provider openai \
  --llm-base-url "https://api.openai.com/v1/chat/completions" \
  --llm-model "gpt-4.1-mini"

# 火山方舟（豆包）示例
npm run scan -- . \
  --llm \
  --llm-provider compatible \
  --llm-base-url "https://ark.cn-beijing.volces.com/api/v3/chat/completions" \
  --llm-model "doubao-seed-1-6-251015"
```

#### 🎯 预设配置

内置多种扫描预设，快速适应不同场景：

| 预设 | 说明 | 适合场景 |
|------|------|---------|
| **strict** | 全规则，高敏感度 | 生产安全扫描 |
| **balanced** | 生产推荐 | 日常开发 |
| **development** | 快速扫描，低误报 | 开发阶段 |
| **ai-focused** | 专注 AI 安全 | Agent/Chatbot 开发 |
| **owasp-only** | 仅 OWASP 规则 | Web 安全扫描 |

**使用方式：**
```bash
# 使用预设
npm run scan -- . --preset strict

# 查看所有预设
npm run scan -- --list-presets
```

#### 🔐 AI 安全规则 (AI-001 ~ AI-016)

新增专门针对 AI 应用和技能的安全规则：

- **AI-001**: 提示注入指令检测
- **AI-002**: 系统提示泄露请求
- **AI-003**: 跨用户上下文获取
- **AI-004**: 角色混淆指令
- **AI-005**: 间接提示注入来源
- **AI-006**: 越狱指令检测
- **AI-007**: 资源耗尽诱导
- **AI-008**: 恶意代码生成请求
- **AI-009**: PII 泄露请求
- **AI-010**: 认证绕过暗示
- **AI-011**: 系统提示拼接用户输入
- **AI-012**: 模型输出驱动命令执行
- **AI-013**: 外部内容注入到提示
- **AI-014**: 日志输出提示内容
- **AI-015**: 关闭安全过滤或审核
- **AI-016**: 未设定最大 token 或超长生成

### 安装与构建

```bash
npm install
npm run build
```

### LLM 扫描配置

```bash
# 设置 API Key（只从环境变量读取，不建议写入配置文件）
export SKILL_SCAN_LLM_API_KEY="your-api-key"
```

### 快速使用

```bash
# 基础扫描
npm run scan -- .
npm run scan -- path/to/project
npm run scan -- path/to/skill.zip

# 使用预设配置
npm run scan -- . --preset strict
npm run scan -- . --preset ai-focused

# 启用 LLM（需要配置完整端点 + model）
npm run scan -- . \
  --llm \
  --llm-base-url "https://api.openai.com/v1/chat/completions" \
  --llm-model "gpt-4.1-mini"
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
npm run scan -- . --enable-group ai-prompt,ai-leak
```

### 基线与阈值

```bash
npm run scan -- . --baseline .skill-scan.baseline.json --write-baseline
npm run scan -- . --baseline .skill-scan.baseline.json
npm run scan -- . --fail-on high
```

### CLI 参数

- `-c, --config <path>` 配置文件路径
- `-o, --output <path>` 保存报告路径
- `-f, --format <format>` 报告格式 (md|json|sarif)
- `--rules-dir <path>` 规则目录路径
- `--enable-group <group>` 启用规则分组（可多次）
- `--disable-rule <id>` 禁用规则 ID（可多次）
- `--baseline <path>` 基线文件路径
- `--write-baseline` 写入当前结果为基线
- `--fail-on <level>` 失败阈值 (low|medium|high|critical)
- `--preset <name>` 使用预设配置
- `--list-presets` 列出所有可用预设
- `--use-llm` 启用 LLM（兼容旧参数）
- `--llm` 启用 LLM（推荐新参数）
- `--llm-provider <provider>` LLM 提供方 (openai|compatible|local)
- `--llm-base-url <url>` LLM 完整端点（必须以 /chat/completions 结尾）
- `--llm-model <model>` 模型名称（OpenAI/方舟等对应的 model 字符串）
- `--llm-mode <mode>` 扫描模式 (targeted|balanced|full)
- `--llm-gate` 将 LLM-DISC 发现纳入阈值判断（默认不纳入）

### 配置文件示例

创建 `skill-scan.config.json`：

```json
{
  "preset": "balanced",
  "include": ["**/*.{js,ts,py,json}"],
  "exclude": ["**/node_modules/**", "**/dist/**", "**/test/**"],
  "rulesDir": "./rules",
  "enabledGroups": ["owasp-top10", "ai-prompt"],
  "disabledRuleIds": ["SEC-002"],
  "baselinePath": ".skill-scan.baseline.json",
  "outputFormat": "md",
  "failOn": "high",
  "llm": {
    "enabled": true,
    "provider": "compatible",
    "baseUrl": "https://ark.cn-beijing.volces.com/api/v3/chat/completions",
    "model": "doubao-seed-1-6-251015",
    "apiKeyEnv": "SKILL_SCAN_LLM_API_KEY",
    "mode": "targeted",
    "gate": false
  }
}
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
      - run: npm run build
      - run: npm run scan -- . --preset strict --format sarif --output report.sarif --fail-on high
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
    - npm run build
    - npm run scan -- . --preset balanced --format json --output report.json --fail-on high
  artifacts:
    paths:
      - report.json
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
  },
  {
    "id": "AI-001",
    "name": "提示注入指令",
    "description": "检测到尝试绕过系统指令的提示注入语句。",
    "severity": "high",
    "type": "regex",
    "pattern": "(ignore|bypass|forget)\\s+(all|previous|system)\\s+(instructions|rules)",
    "fix": "对用户输入进行指令隔离与安全过滤，避免覆盖系统提示。",
    "tags": ["ai", "prompt-injection"],
    "group": "ai-prompt"
  }
]
```

## English

Skill Scan is a security scanning tool for Skill projects. It supports regex and AST-based detection, **LLM semantic analysis**, rule grouping, baseline management, JSON/SARIF report output, and CI/CD integration.

### Features

- **Multi-engine scanning**: Regex + AST + **LLM semantic analysis**
- Line-level ignore and baseline-based false-positive management
- Enable/disable rule groups and load rules from a directory
- **Preset configurations**: strict / balanced / development / ai-focused
- Output reports in Markdown / JSON / SARIF
- Scan directories, files, and zip archives

### Quick Start

```bash
npm install
npm run build
npm run scan -- .
```

### Usage with Presets

```bash
# Use built-in presets
npm run scan -- . --preset strict
npm run scan -- . --preset ai-focused

# List all presets
npm run scan -- --list-presets
```

### LLM Scanning

```bash
# Set API key
export SKILL_SCAN_LLM_API_KEY="your-api-key"

# Note: --llm-base-url must be the full endpoint and must end with /chat/completions

# OpenAI example
npm run scan -- . \
  --llm \
  --llm-provider openai \
  --llm-base-url "https://api.openai.com/v1/chat/completions" \
  --llm-model "gpt-4.1-mini"

# Volcengine Ark (Doubao) example
npm run scan -- . \
  --llm \
  --llm-provider compatible \
  --llm-base-url "https://ark.cn-beijing.volces.com/api/v3/chat/completions" \
  --llm-model "doubao-seed-1-6-251015"
```

### Preset Configurations

| Preset | Description | Use Case |
|---------|-------------|------------|
| **strict** | All rules, high sensitivity | Production security scan |
| **balanced** | Production recommended | Daily development |
| **development** | Fast scan, low false positives | Development phase |
| **ai-focused** | Focus on AI security | Agent/Chatbot development |
| **owasp-only** | Only OWASP rules | Web security scanning |

### CLI Options

- `-c, --config <path>` Config file path
- `-o, --output <path>` Output report path
- `-f, --format <format>` Report format (md|json|sarif)
- `--rules-dir <path>` Rules directory path
- `--enable-group <group>` Enable rule group (repeatable)
- `--disable-rule <id>` Disable rule ID (repeatable)
- `--baseline <path>` Baseline file path
- `--write-baseline` Write current results as baseline
- `--fail-on <level>` Failure threshold (low|medium|high|critical)
- `--preset <name>` Use preset configuration
- `--list-presets` List all available presets
- `--use-llm` Enable LLM (legacy flag)
- `--llm` Enable LLM (recommended)
- `--llm-provider <provider>` LLM provider (openai|compatible|local)
- `--llm-base-url <url>` Full endpoint (must end with /chat/completions)
- `--llm-model <model>` Model name/id
- `--llm-mode <mode>` Scan mode (targeted|balanced|full)
- `--llm-gate` Include LLM-DISC in failure threshold

### CI Integration

**GitHub Actions:**
```yaml
- run: npm run scan -- . --preset strict --format sarif --output report.sarif --fail-on high
- uses: github/codeql-action/upload-sarif@v3
  with:
    sarif_file: report.sarif
```

### License

MIT License
