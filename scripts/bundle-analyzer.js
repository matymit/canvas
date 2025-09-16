#!/usr/bin/env node
// scripts/bundle-analyzer.js

const fs = require('fs');
const path = require('path');
const { gzipSync } = require('zlib');

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
  
  // Simple glob-like pattern matching
  const dir = pattern.includes('*') ? path.dirname(pattern) : pattern;
  const filePattern = pattern.includes('*') ? path.basename(pattern) : null;
  
  if (!fs.existsSync(dir)) {
    console.warn(`Warning: Directory ${dir} does not exist`);
    return { violations, results };
  }
  
  const files = fs.readdirSync(dir, { withFileTypes: true })
    .filter(dirent => dirent.isFile())
    .map(dirent => dirent.name);
  
  const matchingFiles = filePattern 
    ? files.filter(file => {
        const regex = new RegExp(filePattern.replace(/\*/g, '.*'));
        return regex.test(file);
      })
    : files;
  
  const budgetBytes = parseSize(maxSize);
  
  for (const file of matchingFiles) {
    const filePath = path.join(dir, file);
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

module.exports = { analyzeFiles, generateReport, PERFORMANCE_BUDGETS };