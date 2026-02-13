import { BaseScanner } from './base';
import { Rule, Vulnerability } from '../types';

/**
 * LLM语义分析扫描器
 * 支持多种LLM提供商：OpenAI、智谱AI (GLM-4)等
 */
export class LLMScanner extends BaseScanner {
  private apiKey: string;
  private baseURL: string;
  private model: string;
  private analyzeIntent: boolean;

  constructor(rules: Rule[], apiKey?: string, model?: string, baseURL?: string, analyzeIntent: boolean = false) {
    super(rules);
    this.apiKey = apiKey || process.env.SKILL_SCAN_LLM_API_KEY || '';
    this.baseURL = baseURL || process.env.SKILL_SCAN_LLM_ENDPOINT || 'https://api.openai.com/v1/chat/completions';
    this.model = model || process.env.SKILL_SCAN_LLM_MODEL || 'gpt-4o-mini';
    this.analyzeIntent = analyzeIntent;
  }

  /**
   * 使用LLM扫描文件内容
   */
  async scan(filePath: string, content: string): Promise<Vulnerability[]> {
    if (!this.apiKey) {
      console.warn('LLM Scanner: No API key provided, skipping LLM analysis');
      console.warn('Set SKILL_SCAN_LLM_API_KEY environment variable or pass apiKey parameter');
      return [];
    }

    const vulnerabilities: Vulnerability[] = [];
    const lines = content.split('\n');
    console.log(`LLM Scanner: Using provider at ${this.baseURL}`);
    console.log(`LLM Scanner: Using model ${this.model}`);

    // 将文件分段，每段100行，避免token超限
    const chunkSize = 100;
    for (let i = 0; i < lines.length; i += chunkSize) {
      const chunkLines = lines.slice(i, i + chunkSize);
      const chunkContent = chunkLines.join('\n');
      const startLine = i + 1;

      try {
        const chunkVulns = await this.analyzeChunk(filePath, chunkContent, startLine, chunkLines);
        vulnerabilities.push(...chunkVulns);
      } catch (error) {
        console.error(`LLM Scanner: Error analyzing chunk starting at line ${startLine}:`, error);
      }
    }

    return vulnerabilities;
  }

  /**
   * 分析单个代码块
   */
  private async analyzeChunk(filePath: string, content: string, startLine: number, lines: string[]): Promise<Vulnerability[]> {
    const prompt = this.analyzeIntent
      ? this.buildIntentAnalysisPrompt(content)
      : this.buildAnalysisPrompt(content, this.rules);

    const response = await this.callLLM(prompt);
    const findings = this.analyzeIntent
      ? this.parseIntentResponse(response)
      : this.parseLLMResponse(response);

    return findings.map(finding => ({
      ruleId: finding.ruleId,
      description: finding.description,
      severity: finding.severity,
      file: filePath,
      line: startLine + (finding.lineOffset || 0),
      codeSnippet: this.getCodeSnippet(lines, finding.lineOffset || 0),
      suggestion: finding.suggestion,
      confidence: finding.confidence || 0.7
    }));
  }

  /**
   * 构建常规分析提示词
   */
  private buildAnalysisPrompt(content: string, rules: Rule[]): string {
    const rulesSummary = rules.map(r => `- ${r.id}: ${r.name} - ${r.description}`).join('\n');
    return `You are a security expert analyzing code for vulnerabilities. Analyze the following code and identify any security issues.

Rules to check:
${rulesSummary}

Code to analyze:
\`\`\`
${content}
\`\`\`

Respond in JSON format:
\`\`\`json
{
  "findings": [
    {
      "ruleId": "SEC-XXX",
      "description": "Brief description of issue",
      "severity": "high|medium|low",
      "lineOffset": 0,
      "suggestion": "How to fix this",
      "confidence": 0.0-1.0
    }
  ]
}
\`\`\`

Be conservative - only report clear security issues. If no issues found, return {"findings": []}.`;
  }

  /**
   * 构建意图分析提示词（XGPT 风格）
   */
  private buildIntentAnalysisPrompt(content: string): string {
    return `你是一个代码安全分析专家。你的任务是分析代码的真实意图，而不仅仅是语法。

## 分析维度

### 1. 表面意图 vs 实际意图
- 代码声称做什么？
- 代码实际做什么？
- 两者是否一致？

### 2. 欺骗性模式检测
- 是否使用合法功能掩盖恶意行为？
- 是否诱导用户执行危险操作？
- 是否将恶意代码伪装成正常功能？

### 3. 社会工程学攻击
- 是否有欺骗性错误消息？
- 是否诱导用户泄露敏感信息？
- 是否提示用户粘贴/执行未知命令？
- 是否伪装成可信工具（如更新程序、系统工具）？

### 4. 外部代码执行风险
- 是否下载并执行外部文件？
- 是否下载到可疑路径？
- 是否使用 eval/exec/动态导入？
- 是否修改系统配置？

### 5. 数据外泄风险
- 是否访问敏感文件（~/.ssh, ~/.aws, /etc/passwd）？
- 是否批量读取环境变量？
- 是否向未知外部地址发送数据？
- 是否隐藏网络连接？

### 6. 持久化机制
- 是否创建系统服务？
- 是否修改 crontab/launchd？
- 是否在启动目录创建文件？

### 7. 跨平台恶意代码
- 是否检测特定平台并执行不同代码？
- 特别是 macOS/Windows 特定代码？

## 判定标准

### ✅ 安全
- 代码意图明确且与描述一致
- 无欺骗性模式
- 无危险的外部操作

### ⚠️ 可疑
- 代码意图与描述部分不一致
- 有不必要的外部操作
- 缺乏充分的文档说明

### 🔴 高危（类似 XGPT 检测）
- 代码表面意图与实际意图严重不符
- 存在社会工程学攻击
- 诱导用户执行危险操作
- 下载并执行不可信外部代码
- 伪装成合法工具进行恶意行为

## 代码分析

\`\`\`
${content}
\`\`\`

## 输出格式

Respond in JSON format:
\`\`\`json
{
  "findings": [
    {
      "ruleId": "SEC-INTENT-001",
      "description": "Brief description of the issue",
      "severity": "critical|high|medium|low",
      "lineOffset": 0,
      "suggestion": "How to fix this issue",
      "confidence": 0.0-1.0
    }
  ],
  "intent_analysis": {
    "stated_intent": "代码声称的目的",
    "actual_intent": "代码实际的目的",
    "intent_mismatch": boolean,
    "deception_detected": boolean,
    "social_engineering": boolean,
    "external_code_execution": {
      "downloads": boolean,
      "executes_downloads": boolean,
      "sources": ["url1", "url2"]
    },
    "data_exfiltration": {
      "sensitive_files": ["file1", "file2"],
      "env_vars_access": boolean,
      "external_connections": ["host1", "host2"]
    },
    "persistence": {
      "creates_services": boolean,
      "modifies_cron": boolean,
      "install_files": ["file1", "file2"]
    },
    "verdict": "safe|suspicious|malicious",
    "reasoning": "详细解释为什么得出这个结论"
  }
}
\`\`\`

如果代码是安全的，返回 {"findings": [], "intent_analysis": {"verdict": "safe"}}。`;
  }

  /**
   * 调用LLM API
   */
  private async callLLM(prompt: string): Promise<string> {
    const endpoint = this.baseURL;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
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
    });

    if (!response.ok) {
      throw new Error(`LLM API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    // 支持多种API响应格式
    if (data.choices && data.choices[0]) {
      return data.choices[0].message.content;
    } else if (data.message && data.message.content) {
      // 智谱API可能返回的格式
      return typeof data.message.content === 'string'
        ? data.message.content
        : JSON.stringify(data.message.content);
    } else if (typeof data === 'string') {
      // 直接返回字符串响应
      return data;
    } else {
      console.error('Unexpected API response format:', JSON.stringify(data));
      throw new Error('Unexpected API response format');
    }
  }

  /**
   * 解析LLM响应（常规扫描）
   */
  private parseLLMResponse(response: string): any[] {
    try {
      let jsonContent = response.trim();
      if (jsonContent.startsWith('```')) {
        const match = jsonContent.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (match && match[1]) {
          jsonContent = match[1].trim();
        } else {
          jsonContent = jsonContent.replace(/^```(?:json)?\s*/, '');
        }
      }
      const parsed = JSON.parse(jsonContent);
      return parsed.findings || [];
    } catch (error) {
      console.error('LLM Scanner: Failed to parse LLM response', error);
      console.error('LLM Scanner: Response was:', response.substring(0, 500));
      return [];
    }
  }

  /**
   * 解析意图分析响应（XGPT 风格）
   */
  private parseIntentResponse(response: string): any[] {
    try {
      let jsonContent = response.trim();
      if (jsonContent.startsWith('```')) {
        const match = jsonContent.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (match && match[1]) {
          jsonContent = match[1].trim();
        } else {
          jsonContent = jsonContent.replace(/^```(?:json)?\s*/, '');
        }
      }
      const parsed = JSON.parse(jsonContent);

      // 输出意图分析结果
      if (parsed.intent_analysis) {
        const intent = parsed.intent_analysis;
        console.log('\n[Intent Analysis]');
        console.log(`  Verdict: ${intent.verdict?.toUpperCase()}`);
        console.log(`  Intent Mismatch: ${intent.intent_mismatch}`);
        console.log(`  Deception: ${intent.deception_detected}`);
        console.log(`  Social Engineering: ${intent.social_engineering}`);

        if (intent.verdict === 'malicious' || intent.verdict === 'suspicious') {
          console.log(`  Reasoning: ${intent.reasoning}`);
        }
      }

      return parsed.findings || [];
    } catch (error) {
      console.error('LLM Scanner: Failed to parse intent response', error);
      console.error('LLM Scanner: Response was:', response.substring(0, 500));
      return [];
    }
  }

  /**
   * 获取代码片段
   */
  private getCodeSnippet(lines: string[], offset: number, contextLines: number = 3): string {
    const start = Math.max(0, offset - contextLines);
    const end = Math.min(lines.length, offset + contextLines + 1);
    return lines.slice(start, end).join('\n');
  }
}
