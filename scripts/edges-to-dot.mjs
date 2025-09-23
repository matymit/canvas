#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';

const [,, edgesPath, dotPath] = process.argv;
if (!edgesPath || !dotPath) {
  console.error('Usage: node scripts/edges-to-dot.mjs <edges.tsv> <out.dot>');
  process.exit(2);
}

const lines = readFileSync(edgesPath, 'utf8').split('\n').filter(Boolean);
let dot = 'digraph G { rankdir=LR; graph [overlap=false]; node [shape=box,fontsize=9]; }\n';
for (const line of lines) {
  const [a,b] = line.split('\t');
  if (a && b) dot += '"' + a + '" -> "' + b + '";\n';
}
writeFileSync(dotPath, dot);
console.log('dot written:', dotPath);


