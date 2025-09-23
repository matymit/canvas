#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';

const [,, jsonPath, metricsPath, edgesPath] = process.argv;
if (!jsonPath || !metricsPath || !edgesPath) {
  console.error('Usage: node scripts/deps-metrics.mjs <graph.json> <metrics.txt> <edges.tsv>');
  process.exit(2);
}

const data = JSON.parse(readFileSync(jsonPath, 'utf8'));
const outDeg = new Map();
const inDeg = new Map();
const edges = []; const nodes = new Set();

for (const m of (data.modules || [])) {
  const from = m.source; nodes.add(from);
  const deps = m.dependencies || [];
  outDeg.set(from, (outDeg.get(from) || 0) + deps.length);
  for (const d of deps) {
    const to = (d.resolved || d.module || '');
    if (!to) continue; nodes.add(to);
    edges.push([from, to]);
    inDeg.set(to, (inDeg.get(to) || 0) + 1);
  }
}

writeFileSync(edgesPath, edges.map(([a,b]) => a + '\t' + b).join('\n'));

function top(map, n){ return Array.from(map.entries()).sort((a,b)=>b[1]-a[1]).slice(0,n); }

const totalDeg = new Map();
for (const n of nodes) totalDeg.set(n, (outDeg.get(n)||0) + (inDeg.get(n)||0));

const idx = new Map(), low = new Map(); let index = 0; const stack = []; const onStack = new Set(); const adj = new Map();
edges.forEach(([a,b]) => { (adj.get(a) || adj.set(a, []).get(a)).push(b); });
const comps = [];
function strongconnect(v){
  idx.set(v, index); low.set(v, index); index++; stack.push(v); onStack.add(v);
  for (const w of (adj.get(v) || [])) {
    if (!idx.has(w)) { strongconnect(w); low.set(v, Math.min(low.get(v), low.get(w))); }
    else if (onStack.has(w)) { low.set(v, Math.min(low.get(v), idx.get(w))); }
  }
  if (low.get(v) === idx.get(v)) {
    const comp = []; let w;
    do { w = stack.pop(); onStack.delete(w); comp.push(w); } while (w !== v);
    comps.push(comp);
  }
}
for (const n of nodes) if (!idx.has(n)) strongconnect(n);
const cyc = comps.filter(c => c.length > 1).sort((a,b)=>b.length-a.length).slice(0,50);

const lines = [];
lines.push('TOP OUT-DEGREE'); top(outDeg,50).forEach(([k,v])=>lines.push(v+'\t'+k));
lines.push(''); lines.push('TOP IN-DEGREE'); top(inDeg,50).forEach(([k,v])=>lines.push(v+'\t'+k));
lines.push(''); lines.push('TOP TOTAL-DEGREE'); top(totalDeg,50).forEach(([k,v])=>lines.push(v+'\t'+k));
lines.push(''); lines.push('SCCs (first 50, size>1)');
cyc.forEach((c,i)=>{ lines.push('['+(i+1)+'] size='+c.length); c.slice(0,30).forEach(n=>lines.push('  '+n)); if(c.length>30) lines.push('  ...'); });

writeFileSync(metricsPath, lines.join('\n'));
console.log('metrics written:', metricsPath);


