import * as assert from 'assert';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as os from 'os';
import * as path from 'path';
import { FileCache } from '../src/llm/cache';
import { parseFirstJsonObject } from '../src/llm/json';
import { redactText } from '../src/llm/redact';
import { Semaphore } from '../src/llm/semaphore';
import { RegexScanner } from '../src/scanners/code';
import { AstScanner } from '../src/scanners/ast';
import { RuleLoader } from '../src/core/rules';
import { ConfigManager } from '../src/core/config';
import { Runner } from '../src/core/runner';
import { Rule } from '../src/types';

let passed = 0;
let failed = 0;

async function runTest(name: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
    passed++;
    console.log(`  ✅ ${name}`);
  } catch (err) {
    failed++;
    console.error(`  ❌ ${name}`);
    console.error(`     ${(err as Error).message}`);
  }
}

/**
 * 运行全部测试用例
 */
async function main(): Promise<void> {
  console.log('\n=== LLM 工具测试 ===');
  await runTest('parseFirstJsonObject - 纯 JSON', testParseFirstJsonObject);
  await runTest('redactText - 脱敏', testRedactText);
  await runTest('Semaphore - 并发控制', testSemaphore);
  await runTest('FileCache - 文件缓存', testFileCache);

  console.log('\n=== RegexScanner 测试 ===');
  await runTest('正则命中 eval()', testRegexScannerMatch);
  await runTest('正则无命中', testRegexScannerNoMatch);
  await runTest('行级忽略 skill-scan-ignore', testRegexScannerIgnoreLine);
  await runTest('无 pattern 规则跳过', testRegexScannerNoPattern);

  console.log('\n=== AstScanner 测试 ===');
  await runTest('AST 命中 call:eval', testAstScannerMatch);
  await runTest('AST 非 JS/TS 文件跳过', testAstScannerUnsupportedFile);
  await runTest('AST 行级忽略', testAstScannerIgnoreLine);
  await runTest('AST 无 selector 规则跳过', testAstScannerNoSelector);

  console.log('\n=== RuleLoader 测试 ===');
  await runTest('加载内置规则', testRuleLoaderBuiltin);
  await runTest('加载规则目录', testRuleLoaderDirectory);
  await runTest('空目录返回空数组', testRuleLoaderEmptyDir);
  await runTest('不存在的目录返回空数组', testRuleLoaderMissingDir);

  console.log('\n=== ConfigManager 测试 ===');
  await runTest('默认配置', testConfigManagerDefault);
  await runTest('预设应用', testConfigManagerPreset);
  await runTest('CLI 覆盖合并', testConfigManagerOverrides);

  console.log('\n=== Runner 测试 ===');
  await runTest('端到端单文件扫描', testRunnerSingleFile);
  await runTest('端到端目录扫描', testRunnerDirectory);

  console.log(`\n总计: ${passed} 通过, ${failed} 失败\n`);
  if (failed > 0) {
    process.exit(1);
  }
}

// ========== LLM 工具测试 ==========

async function testParseFirstJsonObject(): Promise<void> {
  assert.deepStrictEqual(parseFirstJsonObject('{"a":1}'), { a: 1 });
  assert.deepStrictEqual(parseFirstJsonObject('前缀文本\n{"a":1,"b":{"c":2}}\n后缀文本'), { a: 1, b: { c: 2 } });
  assert.deepStrictEqual(parseFirstJsonObject('```json\n{"ok":true}\n```'), { ok: true });
}

async function testRedactText(): Promise<void> {
  const key = [
    '-----BEGIN PRIVATE KEY-----',
    'ABCDEF',
    '-----END PRIVATE KEY-----'
  ].join('\n');
  const r1 = redactText(key);
  assert.strictEqual(r1.changed, true);
  assert.ok(r1.redactedText.includes('[已脱敏]'));

  const r2 = redactText('Authorization: Bearer abcdefg12345');
  assert.strictEqual(r2.changed, true);
  assert.ok(r2.redactedText.includes('Bearer [已脱敏]'));
}

async function testSemaphore(): Promise<void> {
  const semaphore = new Semaphore(1);
  const order: string[] = [];

  const release1 = await semaphore.acquire();
  order.push('a1');

  const p2 = semaphore.acquire().then((release2) => {
    order.push('a2');
    release2();
  });

  await sleep(50);
  order.push('before-release');
  release1();
  await p2;
  order.push('after-release');

  assert.deepStrictEqual(order, ['a1', 'before-release', 'a2', 'after-release']);
}

async function testFileCache(): Promise<void> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'skill-scan-test-cache-'));
  const cache = new FileCache(dir);

  const key = 'k1';
  const miss = await cache.get<{ a: number }>(key);
  assert.strictEqual(miss.hit, false);

  await cache.set(key, { a: 1 });
  const hit = await cache.get<{ a: number }>(key);
  assert.strictEqual(hit.hit, true);
  assert.deepStrictEqual(hit.value, { a: 1 });
}

// ========== RegexScanner 测试 ==========

function makeRegexRule(overrides: Partial<Rule> = {}): Rule {
  return {
    id: 'TEST-001',
    name: 'Test Rule',
    description: 'Test regex rule',
    severity: 'high',
    type: 'regex',
    pattern: 'eval\\(',
    fix: 'Do not use eval',
    tags: ['test'],
    group: 'test',
    ...overrides
  };
}

async function testRegexScannerMatch(): Promise<void> {
  const scanner = new RegexScanner([makeRegexRule()]);
  const results = await scanner.scan('test.js', 'const x = eval("code");');
  assert.strictEqual(results.length, 1);
  assert.strictEqual(results[0].ruleId, 'TEST-001');
  assert.strictEqual(results[0].line, 1);
}

async function testRegexScannerNoMatch(): Promise<void> {
  const scanner = new RegexScanner([makeRegexRule()]);
  const results = await scanner.scan('test.js', 'const x = JSON.parse("{}");');
  assert.strictEqual(results.length, 0);
}

async function testRegexScannerIgnoreLine(): Promise<void> {
  const scanner = new RegexScanner([makeRegexRule()]);
  const results = await scanner.scan('test.js', 'const x = eval("code"); // skill-scan-ignore');
  assert.strictEqual(results.length, 0);
}

async function testRegexScannerNoPattern(): Promise<void> {
  const rule = makeRegexRule({ pattern: undefined });
  const scanner = new RegexScanner([rule]);
  const results = await scanner.scan('test.js', 'eval("code")');
  assert.strictEqual(results.length, 0);
}

// ========== AstScanner 测试 ==========

function makeAstRule(overrides: Partial<Rule> = {}): Rule {
  return {
    id: 'AST-001',
    name: 'Eval Call',
    description: 'Detected eval call',
    severity: 'critical',
    type: 'ast',
    selector: 'call:eval',
    fix: 'Do not use eval',
    tags: ['test'],
    group: 'test',
    ...overrides
  };
}

async function testAstScannerMatch(): Promise<void> {
  const scanner = new AstScanner([makeAstRule()]);
  const results = await scanner.scan('test.ts', 'const x = eval("code");');
  assert.strictEqual(results.length, 1);
  assert.strictEqual(results[0].ruleId, 'AST-001');
}

async function testAstScannerUnsupportedFile(): Promise<void> {
  const scanner = new AstScanner([makeAstRule()]);
  const results = await scanner.scan('test.py', 'eval("code")');
  assert.strictEqual(results.length, 0);
}

async function testAstScannerIgnoreLine(): Promise<void> {
  const scanner = new AstScanner([makeAstRule()]);
  const results = await scanner.scan('test.ts', 'const x = eval("code"); // skill-scan-ignore');
  assert.strictEqual(results.length, 0);
}

async function testAstScannerNoSelector(): Promise<void> {
  const rule = makeAstRule({ selector: undefined });
  const scanner = new AstScanner([rule]);
  const results = await scanner.scan('test.ts', 'eval("code")');
  assert.strictEqual(results.length, 0);
}

// ========== RuleLoader 测试 ==========

async function testRuleLoaderBuiltin(): Promise<void> {
  const rules = RuleLoader.loadBuiltinRules();
  assert.ok(rules.length > 0, 'Should load at least one builtin rule');
  assert.ok(rules.some(r => r.id === 'SEC-001'), 'Should contain SEC-001');
  assert.ok(rules.some(r => r.id.startsWith('AI-')), 'Should contain AI rules');
}

async function testRuleLoaderDirectory(): Promise<void> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'skill-scan-test-rules-'));
  const testRules: Rule[] = [
    {
      id: 'CUSTOM-001',
      name: 'Custom Rule',
      description: 'A custom test rule',
      severity: 'low',
      type: 'regex',
      pattern: 'TODO',
      fix: 'Remove TODO',
      tags: ['custom'],
      group: 'custom'
    }
  ];
  await fs.writeFile(path.join(dir, 'custom.json'), JSON.stringify(testRules));

  const loaded = RuleLoader.loadRulesFromDirectory(dir);
  assert.strictEqual(loaded.length, 1);
  assert.strictEqual(loaded[0].id, 'CUSTOM-001');
}

async function testRuleLoaderEmptyDir(): Promise<void> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'skill-scan-test-empty-'));
  const loaded = RuleLoader.loadRulesFromDirectory(dir);
  assert.strictEqual(loaded.length, 0);
}

async function testRuleLoaderMissingDir(): Promise<void> {
  const loaded = RuleLoader.loadRulesFromDirectory('/nonexistent/path/rules');
  assert.strictEqual(loaded.length, 0);
}

// ========== ConfigManager 测试 ==========

async function testConfigManagerDefault(): Promise<void> {
  const cm = new ConfigManager();
  const config = cm.getConfig();
  assert.ok(config.include, 'Should have default include patterns');
  assert.ok(config.exclude, 'Should have default exclude patterns');
  assert.strictEqual(config.llm?.enabled, false, 'LLM should be disabled by default');
  assert.strictEqual(config.outputFormat, 'md', 'Default format should be md');
}

async function testConfigManagerPreset(): Promise<void> {
  const cm = new ConfigManager();
  const applied = cm.applyPreset('strict');
  assert.strictEqual(applied, true, 'Should apply strict preset');
  const config = cm.getConfig();
  assert.strictEqual(config.failOn, 'low', 'Strict preset should fail on low');
}

async function testConfigManagerOverrides(): Promise<void> {
  const cm = new ConfigManager();
  cm.applyOverrides({
    failOn: 'critical',
    outputFormat: 'json'
  });
  const config = cm.getConfig();
  assert.strictEqual(config.failOn, 'critical');
  assert.strictEqual(config.outputFormat, 'json');
}

// ========== Runner 测试 ==========

async function testRunnerSingleFile(): Promise<void> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'skill-scan-test-runner-'));
  const testFile = path.join(dir, 'vulnerable.js');
  await fs.writeFile(testFile, 'const x = eval("dangerous");');

  const runner = new Runner();
  const result = await runner.run(testFile);

  assert.ok(result.stats.filesScanned >= 1, 'Should scan at least 1 file');
  assert.ok(result.vulnerabilities.length > 0, 'Should find vulnerabilities in eval code');
  assert.ok(result.vulnerabilities.some(v => v.ruleId === 'SEC-001' || v.ruleId === 'SEC-101'),
    'Should detect eval via regex or AST');
}

async function testRunnerDirectory(): Promise<void> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'skill-scan-test-runner-dir-'));
  await fs.writeFile(path.join(dir, 'safe.js'), 'const x = JSON.parse("{}");');
  await fs.writeFile(path.join(dir, 'vuln.js'), 'const y = eval("code");');

  const runner = new Runner();
  const result = await runner.run(dir);

  assert.ok(result.stats.filesScanned >= 2, 'Should scan at least 2 files');
  assert.ok(result.vulnerabilities.length > 0, 'Should find vulnerabilities');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
