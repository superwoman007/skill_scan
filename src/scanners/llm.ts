import { Rule, Vulnerability } from '../types';
import { BaseScanner } from './base';

/**
 * LLM语义分析扫描器
 * 支持多种LLM提供商：OpenAI、智谱AI (GLM-4)等
 */
export class LLMScanner extends BaseScanner {
  private apiKey?: string;
  private model: string;
  private baseURL: string;

  constructor(rules: Rule[], apiKey?: string, model?: string, baseURL?: string) {
    super(rules);
    this.apiKey = apiKey || process.env.SKILL_SCAN_LLM_API_KEY;
    this.baseURL = baseURL || process.env.SKILL_SCAN_LLM_ENDPOINT || 'https://api.openai.com/v1/chat/completions';
    this.model = model || process.env.SKILL_SCAN_LLM_MODEL || 'gpt-4o-mini';
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
        const chunkVulns = await this.analyzeChunk(
          filePath,
          chunkContent,
          startLine,
          chunkLines
        );
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
  private async analyzeChunk(
    filePath: string,
    content: string,
    startLine: number,
    lines: string[]
  ): Promise<Vulnerability[]> {
    const prompt = this.buildAnalysisPrompt(content, this.rules);

    const response = await this.callLLM(prompt);
    const findings = this.parseLLMResponse(response);

    return findings.map(finding => ({
      ruleId: finding.ruleId,
      description: finding.description,
      severity: finding.severity,
      file: filePath,
      line: startLine + (finding.lineOffset || 0),
      codeSnippet: this.getCodeSnippet(lines, finding.lineOffset || 0),
      suggestion: finding.suggestion,
      confidence: finding.confidence || 0.7
    } as Vulnerability));
  }

  /**
   * 构建分析提示词
   */
  private buildAnalysisPrompt(content: string, rules: Rule[]): string {
    const rulesSummary = rules.map(r => 
      `- ${r.id}: ${r.name} - ${r.description}`
    ).join('\n');

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
      "description": "Brief description of the issue",
      "severity": "high|medium|low",
      "lineOffset": 0 (relative to the start of the chunk),
      "suggestion": "How to fix this",
      "confidence": 0.0-1.0
    }
  ]
}
\`\`\`

Be conservative - only report clear security issues. If no issues found, return {"findings": []}.`;
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
            content: 'You are a security code analysis assistant. Always respond with valid JSON.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' }
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
    } else {
      throw new Error('Unexpected API response format');
    }
  }

  /**
   * 解析LLM响应
   */
  private parseLLMResponse(response: string): any[] {
    try {
      const parsed = JSON.parse(response);
      return parsed.findings || [];
    } catch (error) {
      console.error('LLM Scanner: Failed to parse LLM response', error);
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
