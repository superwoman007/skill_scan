const ts = require('typescript');
const fs = require('fs');
const path = require('path');

console.log('=== TypeScript Compiler ===');
console.log('TypeScript version:', ts.version);
console.log('');

// Parse config properly
const configPath = path.join(__dirname, 'tsconfig.json');
const configText = fs.readFileSync(configPath, 'utf-8');
const configParseResult = ts.parseJsonConfigFileContent(
  JSON.parse(configText),
  ts.sys,
  __dirname
);

console.log('=== Config ===');
console.log('Files:', configParseResult.fileNames.length);
configParseResult.fileNames.slice(0, 5).forEach(f => console.log('  -', f));
if (configParseResult.fileNames.length > 5) {
  console.log('  ... and more');
}
console.log('');

// Compile
const host = ts.createCompilerHost(configParseResult.options, false);
const program = ts.createProgram(
  configParseResult.fileNames,
  configParseResult.options,
  host
);

console.log('=== Compilation Info ===');
console.log('Root files:', program.getRootFileNames().length);
console.log('');

const emitResult = program.emit();

console.log('=== Compilation Result ===');
console.log('Emit skipped:', emitResult.emitSkipped);
console.log('Diagnostics:', emitResult.diagnostics.length);
console.log('');

// Check dist
const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
  const distFiles = [];
  function findDistFiles(dir) {
    const files = fs.readdirSync(dir, { withFileTypes: true });
    for (const file of files) {
      const fullPath = path.join(dir, file.name);
      if (file.isDirectory()) {
        findDistFiles(fullPath);
      } else {
        distFiles.push(fullPath);
      }
    }
  }
  findDistFiles(distPath);
  
  console.log('Dist files:', distFiles.length);
  distFiles.forEach(f => console.log('  -', path.relative(__dirname, f)));
} else {
  console.log('Dist directory does not exist');
}
console.log('');

// Report errors
const allDiagnostics = [
  ...program.getSyntacticDiagnostics(),
  ...program.getSemanticDiagnostics(),
  ...emitResult.diagnostics
];

if (allDiagnostics.length > 0) {
  console.log('=== Errors ===');
  allDiagnostics.forEach(diagnostic => {
    const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
    const file = diagnostic.file ? path.relative(__dirname, diagnostic.file.fileName) : 'unknown';
    const line = diagnostic.start ? diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start).line : '?';
    console.log(`[${file}:${line}] ${message}`);
  });
} else {
  console.log('✅ No errors!');
}
