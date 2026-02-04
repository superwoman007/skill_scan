# Skill Scan

Skill Scan 是一个面向技能（Skill）项目的安全扫描工具，支持正则与 AST 检测、规则分组、基线管理、JSON/SARIF 报告输出，并可集成到 CI/CD 流水线中。

## 功能特性
- 正则与 AST 双引擎扫描（JS/TS 语法级调用识别）
- 行级忽略与基线误报管理
- 规则分组启停与规则目录加载
- Markdown / JSON / SARIF 报告输出
- 支持扫描目录、文件与 zip 包

## 技术架构
### 架构概览
- CLI 层：命令行参数解析、报告输出、退出码控制
- 配置层：读取配置文件与命令行覆盖配置
- 规则层：内置规则 + 自定义规则 + 规则目录加载
- 扫描层：正则扫描 + AST 扫描
- 输出层：Markdown / JSON / SARIF

### 目录结构
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

## 已实现功能
- AST 调用检测（call:eval、call:exec、call:execSync、call:spawn）
- 行级忽略机制（skill-scan-ignore 与 skill-scan-ignore:规则ID）
- 基线写入与过滤（baseline 文件）
- 规则分组与按组启用/禁用
- 规则目录加载（多 JSON 文件）
- JSON/SARIF 报告输出
- CLI 失败阈值（fail-on）与退出码控制

## 安装与构建
```bash
npm install
npm run build
```

## 快速使用
```bash
npm run scan -- .
npm run scan -- path/to/project
npm run scan -- path/to/skill.zip
```

## 报告输出
```bash
npm run scan -- . --output report.md
npm run scan -- . --format json --output report.json
npm run scan -- . --format sarif --output report.sarif
```

## 规则与分组
```bash
npm run scan -- . --rules-dir ./rules
npm run scan -- . --enable-group owasp-top10 --disable-rule SEC-002
```

## 基线与阈值
```bash
npm run scan -- . --baseline .skill-scan.baseline.json --write-baseline
npm run scan -- . --baseline .skill-scan.baseline.json
npm run scan -- . --fail-on high
```

## CLI 参数
- -c, --config <path> 配置文件路径
- -o, --output <path> 保存报告路径
- -f, --format <format> 报告格式 (md|json|sarif)
- --rules-dir <path> 规则目录路径
- --enable-group <group> 启用规则分组（可多次）
- --disable-rule <id> 禁用规则 ID（可多次）
- --baseline <path> 基线文件路径
- --write-baseline 写入当前结果为基线
- --fail-on <level> 失败阈值 (low|medium|high|critical)

## 配置文件示例
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
  "failOn": "high"
}
```

使用配置文件：
```bash
npm run scan -- . -c ./skill-scan.config.json
```

## 规则格式
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

## CI 集成

### GitHub Actions
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

### GitLab CI
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

