import * as assert from 'assert';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { FileCache } from '../src/llm/cache';
import { parseFirstJsonObject } from '../src/llm/json';
import { redactText } from '../src/llm/redact';
import { Semaphore } from '../src/llm/semaphore';

/**
 * 运行全部测试用例
 * @returns {Promise<void>} 执行完成
 */
async function main(): Promise<void> {
  await testParseFirstJsonObject();
  await testRedactText();
  await testSemaphore();
  await testFileCache();
  console.log('全部测试通过');
}

/**
 * 测试 JSON 提取与解析
 * @returns {Promise<void>} 执行完成
 */
async function testParseFirstJsonObject(): Promise<void> {
  assert.deepStrictEqual(parseFirstJsonObject('{"a":1}'), { a: 1 });
  assert.deepStrictEqual(parseFirstJsonObject('前缀文本\\n{"a":1,"b":{"c":2}}\\n后缀文本'), { a: 1, b: { c: 2 } });
  assert.deepStrictEqual(parseFirstJsonObject('```json\\n{"ok":true}\\n```'), { ok: true });
}

/**
 * 测试脱敏逻辑
 * @returns {Promise<void>} 执行完成
 */
async function testRedactText(): Promise<void> {
  const key = [
    '-----BEGIN PRIVATE KEY-----',
    'ABCDEF',
    '-----END PRIVATE KEY-----'
  ].join('\\n');
  const r1 = redactText(key);
  assert.strictEqual(r1.changed, true);
  assert.ok(r1.redactedText.includes('[已脱敏]'));

  const r2 = redactText('Authorization: Bearer abcdefg12345');
  assert.strictEqual(r2.changed, true);
  assert.ok(r2.redactedText.includes('Bearer [已脱敏]'));
}

/**
 * 测试并发信号量
 * @returns {Promise<void>} 执行完成
 */
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

/**
 * 测试文件缓存
 * @returns {Promise<void>} 执行完成
 */
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

/**
 * 简单 sleep
 * @param {number} ms - 毫秒
 * @returns {Promise<void>} 延迟完成
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
