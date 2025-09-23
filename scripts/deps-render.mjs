#!/usr/bin/env node
import { promises as fs } from 'node:fs';
import { Graphviz } from '@hpcc-js/wasm';

const [,, dotPath, svgPath] = process.argv;
if (!dotPath || !svgPath) {
  console.error('Usage: node scripts/deps-render.mjs <in.dot> <out.svg>');
  process.exit(2);
}

const dot = await fs.readFile(dotPath, 'utf8');
const gv = await Graphviz.load();
const svg = gv.layout(dot, 'svg', 'dot');
await fs.mkdir(svgPath.substring(0, svgPath.lastIndexOf('/')), { recursive: true });
await fs.writeFile(svgPath, svg);
console.log('SVG written:', svgPath, svg.length);


