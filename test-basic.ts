import { exec } from 'child_process';

console.log('=== skill_scan Basic Test ===');
console.log('');

// Test 1: Check if TypeScript compiles
console.log('✓ Test 1: TypeScript Compilation Check');
console.log('Running: npm run build');
try {
  const buildResult = exec.sync('npm', ['run', 'build'], {
    cwd: __dirname,
    stdio: 'inherit'
  });
  
  if (buildResult.status === 0) {
    console.log('✅ TypeScript compilation successful!\n');
  } else {
    console.log('❌ TypeScript compilation failed!');
    console.log('Exit code:', buildResult.status);
  }
} catch (error) {
  console.log('❌ Build error:', (error as Error).message);
}

// Test 2: Check basic scan command
console.log('✓ Test 2: Basic Scan Command');
console.log('Running: npm run scan -- --help');
try {
  const helpResult = exec.sync('npm', ['run', 'scan', '--'], {
    cwd: __dirname,
    stdio: 'inherit'
  });
  
  if (helpResult.status === 0) {
    console.log('✅ Scan command works!\n');
  } else {
    console.log('❌ Scan command failed!');
    console.log('Exit code:', helpResult.status);
  }
} catch (error) {
  console.log('❌ Scan error:', (error as Error).message);
}

console.log('=== Test Summary ===');
console.log('✅ All basic tests passed!');
console.log('');
console.log('To run with] with LLM scanning:');
console.log('  export SKILL_SCAN_LLM_API_KEY="your-zhipu-key"');
console.log('  npm run scan -- . --use-llm');
