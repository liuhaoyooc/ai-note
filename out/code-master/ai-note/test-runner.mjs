#!/usr/bin/env node

/**
 * 测试运行器辅助脚本
 * 用于快速运行特定类型的测试
 */

import { spawn } from 'child_process';
import path from 'path';

const testCategories = {
  unit: 'tests/unit',
  integration: 'tests/integration',
  boundary: 'tests/boundary',
  core: 'tests/integration/core',
  archive: 'tests/integration/archive',
  review: 'tests/integration/review',
  research: 'tests/integration/research',
  links: 'tests/integration/links',
};

const args = process.argv.slice(2);
const category = args[0];

if (!category) {
  console.log('Usage: node test-runner.mjs <category> [test-name]');
  console.log('\nAvailable categories:');
  Object.keys(testCategories).forEach(key => {
    console.log(`  ${key} - ${testCategories[key]}`);
  });
  console.log('\nExamples:');
  console.log('  node test-runner.mjs unit');
  console.log('  node test-runner.mjs integration');
  console.log('  node test-runner.mjs boundary');
  process.exit(1);
}

const testPath = testCategories[category];

if (!testPath) {
  console.error(`Unknown category: ${category}`);
  process.exit(1);
}

const vitestArgs = ['run', testPath];

if (args[1]) {
  vitestArgs.push('-t', args[1]);
}

console.log(`Running tests in ${testPath}...`);

const vitest = spawn('npm', ['test', '--', ...vitestArgs], {
  cwd: path.resolve(process.cwd()),
  stdio: 'inherit',
});

vitest.on('close', (code) => {
  process.exit(code || 0);
});
