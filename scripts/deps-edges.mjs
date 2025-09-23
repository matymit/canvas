#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';

const [,, jsonPath, edgesPath] = process.argv;
if (!jsonPath || !edgesPath) {
  console.error('Usage: node scripts/deps-edges.mjs <graph.json> <edges.tsv>');
  process.exit(2);
}

const data = JSON.parse(readFileSync(jsonPath, 'utf8'));
const out = [];
for (const m of (data.modules || [])) {
  const from = m.source;
  for (const d of (m.dependencies || [])) {
    const to = (d.resolved || d.module || '');
    if (!to) continue;
    if (!(to.startsWith('.') || to.startsWith('@/') || to.startsWith('@features/'))) continue;
    const norm = to.replace(/^@\//,'').replace(/^@features\//,'src/features/');
    out.push(from + '\t' + norm);
  }
}
writeFileSync(edgesPath, out.join('\n'));
console.log('edges written:', edgesPath, out.length);


