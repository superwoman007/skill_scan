#!/usr/bin/env node

// 直接测试 runner
const { Runner } = require('./dist/core/runner.js');

const runner = new Runner();

async function test() {
  const overrides = {
    useLlm: true,
    rulesDir: './src/rules'
  };

  console.log('Running test scan...');
  console.log('Overrides:', JSON.stringify(overrides, null, 2));

  try {
    const result = await runner.run('/root/clawd/skills/email', overrides);
    console.log('Result:', JSON.stringify(result, null, 2));
  } catch (err) {
    console.error('Error:', err);
  }
}

test();
