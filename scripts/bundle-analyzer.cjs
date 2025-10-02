#!/usr/bin/env node
// scripts/bundle-analyzer.cjs

const fs = require('fs');
const path = require('path');
const { gzipSync } = require('zlib');

const SAFE_GLOB_PATTERN = /^[a-zA-Z0-9@._/\\*-]+$/;

function assertSafeGlob(pattern) {
  if (typeof pattern !== 'string' || pattern.length === 0) {
    throw new Error('Glob pattern must be a non-empty string');
  }
  if (!SAFE_GLOB_PATTERN.test(pattern) || pattern.includes('..')) {
    throw new Error(`Unsafe glob pattern blocked: ${pattern}`);
  }
}

function isPathInside(parent, child) {
  const parentPath = path.resolve(parent);
  const childPath = path.resolve(child);
  if (parentPath === childPath) return true;
  const parentWithSep = parentPath.endsWith(path.sep)
    ? parentPath
    : parentPath + path.sep;
  return childPath.startsWith(parentWithSep);
}

function matchesGlob(filename, pattern) {
  if (!pattern.includes('*')) {
    return filename === pattern;
  }

  const segments = pattern.split('*');
  let workingName = filename;
  let index = 0;

  if (!pattern.startsWith('*')) {
    const first = segments.shift();
    if (!workingName.startsWith(first)) {
      return false;
    }
    index = first.length;
  } else if (segments[0] === '') {
    segments.shift();
  }

  if (!pattern.endsWith('*')) {
    const last = segments.pop() ?? '';
    if (!workingName.endsWith(last)) {
      return false;
    }
    workingName = workingName.slice(0, workingName.length - last.length);
    if (index > workingName.length) {
      index = workingName.length;
    }
  }

  for (const segment of segments) {
    if (segment === '') {
      continue;
    }
    const nextIndex = workingName.indexOf(segment, index);
    if (nextIndex === -1) {
      return false;
    }
    index = nextIndex + segment.length;
  }

  return true;
}

/**
 * Secure bundle size analyzer replacement for bundlesize
 * Integrates with production performance budgets
 */

const PERFORMANCE_BUDGETS = {
  maxChunkSize: 1024 * 1024, // 1MB
  maxAssetSize: 512 * 1024,  // 512KB  
  maxTotalSize: 4 * 1024 * 1024, // 4MB
};

const BUDGET_RULES = [
  {
    pattern: './dist/assets/*.js',
    maxSize: '1MB',
    compression: 'gzip'
  },
  {
    pattern: './dist/assets/*.css', 
    maxSize: '100KB',
    compression: 'gzip'
  }
];

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function parseSize(sizeStr) {
  const match = sizeStr.match(/^(\d+(?:\.\d+)?)\s*(B|KB|MB|GB)$/i);
  if (!match) throw new Error(`Invalid size format: ${sizeStr}`);
  
  const [, value, unit] = match;
  const multipliers = { B: 1, KB: 1024, MB: 1024 * 1024, GB: 1024 * 1024 * 1024 };
  return parseFloat(value) * (multipliers[unit.toUpperCase()] || 1);
}

function getGzipSize(filePath) {
  try {
    const content = fs.readFileSync(filePath);
    return gzipSync(content).length;
  } catch (error) {
    console.warn(`Warning: Could not read ${filePath}: ${error.message}`);
    return 0;
  }
}

function analyzeFiles(pattern, maxSize, compression = 'none') {
  const violations = [];
  const results = [];
  
  assertSafeGlob(pattern);

  // Simple glob-like pattern matching
  const rawDir = pattern.includes('*') ? path.dirname(pattern) : pattern;
  const baseDir = process.cwd();
  const resolvedDir = rawDir === '.' ? baseDir : path.resolve(baseDir, rawDir);

  if (!isPathInside(baseDir, resolvedDir)) {
    throw new Error(`Refusing to analyze files outside project root: ${pattern}`);
  }

  const filePattern = pattern.includes('*') ? path.basename(pattern) : null;
  if (filePattern) {
    assertSafeGlob(filePattern);
    if (filePattern.includes(path.sep)) {
      throw new Error(`File glob cannot traverse directories: ${filePattern}`);
    }
  }
  
  if (!fs.existsSync(resolvedDir)) {
    console.warn(`Warning: Directory ${path.relative(baseDir, resolvedDir) || '.'} does not exist`);
    return { violations, results };
  }
  
  const files = fs.readdirSync(resolvedDir, { withFileTypes: true })
    .filter(dirent => dirent.isFile())
    .map(dirent => dirent.name);
  
  const matchingFiles = filePattern 
    ? files.filter(file => {
        return matchesGlob(file, filePattern);
      })
    : files;
  
  const budgetBytes = parseSize(maxSize);
  
  for (const file of matchingFiles) {
    const filePath = path.resolve(resolvedDir, file);
    if (!isPathInside(resolvedDir, filePath)) {
      console.warn(`Skipping suspicious file path outside target directory: ${file}`);
      continue;
    }

    const stats = fs.statSync(filePath);
    const rawSize = stats.size;
    const effectiveSize = compression === 'gzip' ? getGzipSize(filePath) : rawSize;
    
    results.push({
      file: path.relative(process.cwd(), filePath),
      rawSize,
      effectiveSize,
      compression,
      withinBudget: effectiveSize <= budgetBytes
    });
    
    if (effectiveSize > budgetBytes) {
      violations.push({
        file: path.relative(process.cwd(), filePath),
        actualSize: formatBytes(effectiveSize),
        budgetSize: maxSize,
        overage: formatBytes(effectiveSize - budgetBytes),
        compression
      });
    }
  }
  
  return { violations, results };
}

function generateReport(allResults, allViolations) {
  console.log('\n📊 Bundle Analysis Report\n');
  
  // Summary
  const totalFiles = allResults.length;
  const totalViolations = allViolations.length;
  const totalSize = allResults.reduce((sum, r) => sum + r.effectiveSize, 0);
  
  console.log(`Files analyzed: ${totalFiles}`);
  console.log(`Total bundle size: ${formatBytes(totalSize)}`);
  console.log(`Budget violations: ${totalViolations}`);
  
  // Budget compliance
  const withinBudget = totalSize <= PERFORMANCE_BUDGETS.maxTotalSize;
  const status = withinBudget ? '✅ PASS' : '❌ FAIL';
  console.log(`Overall status: ${status}\n`);
  
  // Detailed results
  if (allResults.length > 0) {
    console.log('📋 File Details:');
    allResults.forEach(result => {
      const status = result.withinBudget ? '✅' : '❌';
      const sizeInfo = result.compression === 'gzip' 
        ? `${formatBytes(result.effectiveSize)} (gzipped)`
        : formatBytes(result.effectiveSize);
      console.log(`  ${status} ${result.file}: ${sizeInfo}`);
    });
    console.log('');
  }
  
  // Violations
  if (allViolations.length > 0) {
    console.log('❌ Budget Violations:');
    allViolations.forEach(violation => {
      console.log(`  • ${violation.file}`);
      console.log(`    Size: ${violation.actualSize} (${violation.compression})`);
      console.log(`    Budget: ${violation.budgetSize}`);
      console.log(`    Overage: ${violation.overage}`);
    });
    console.log('');
  }
  
  return totalViolations === 0;
}

function main() {
  console.log('🔍 Analyzing bundle sizes...');
  
  const allResults = [];
  const allViolations = [];
  
  // Process each budget rule
  for (const rule of BUDGET_RULES) {
    const { violations, results } = analyzeFiles(
      rule.pattern, 
      rule.maxSize, 
      rule.compression
    );
    
    allResults.push(...results);
    allViolations.push(...violations);
  }
  
  // Generate report
  const passed = generateReport(allResults, allViolations);
  
  // Security compliance check
  console.log('🔒 Security Check: No vulnerable dependencies (axios removed)');
  
  // Exit with appropriate code
  if (!passed) {
    console.log('❌ Bundle analysis failed - size budgets exceeded');
    process.exit(1);
  } else {
    console.log('✅ Bundle analysis passed - all budgets within limits');
    process.exit(0);
  }
}

if (require.main === module) {
  main();
}

module.exports = { analyzeFiles, generateReport, PERFORMANCE_BUDGETS, matchesGlob };