#!/usr/bin/env node

/**
 * Pre-install script to prevent forbidden packages from being installed
 * This enforces the Canvas project's architectural constraint against react-konva
 */

const fs = require('fs');
const path = require('path');

const FORBIDDEN_PACKAGES = [
  'react-konva',
  '@konva/react',
  'react-canvas-konva'
];

const REASON = `
❌ FORBIDDEN PACKAGE DETECTED!

The Canvas project architecture specifically prohibits react-konva and related packages.
You must use vanilla Konva.js directly (Konva.Stage, Konva.Layer, Konva.Node).

See CLAUDE.md for architectural requirements:
- Use vanilla Konva instance management only
- NO react-konva under any circumstances
- Direct Konva manipulation for performance

Remove the forbidden package from package.json and use vanilla Konva instead.
`;

function checkPackageJson() {
  try {
    const packageJsonPath = path.join(process.cwd(), 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    
    const allDeps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
      ...packageJson.peerDependencies,
      ...packageJson.optionalDependencies
    };
    
    const foundForbidden = FORBIDDEN_PACKAGES.filter(pkg => allDeps[pkg]);
    
    if (foundForbidden.length > 0) {
      console.error(REASON);
      console.error(`Forbidden packages found: ${foundForbidden.join(', ')}`);
      process.exit(1);
    }
    
    console.log('✅ No forbidden packages detected in package.json');
  } catch (error) {
    console.error('Error checking package.json:', error.message);
    process.exit(1);
  }
}

function checkNodeModules() {
  const nodeModulesPath = path.join(process.cwd(), 'node_modules');
  
  if (!fs.existsSync(nodeModulesPath)) {
    return; // No node_modules yet, that's fine
  }
  
  const foundForbidden = FORBIDDEN_PACKAGES.filter(pkg => {
    return fs.existsSync(path.join(nodeModulesPath, pkg));
  });
  
  if (foundForbidden.length > 0) {
    console.error(REASON);
    console.error(`Forbidden packages found in node_modules: ${foundForbidden.join(', ')}`);
    console.error('Run: npm uninstall ' + foundForbidden.join(' '));
    process.exit(1);
  }
}

// Run checks
checkPackageJson();
checkNodeModules();