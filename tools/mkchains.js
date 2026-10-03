const fs = require('fs');
const path = require('path');

const repo = path.resolve(__dirname, '..');
const planArg = process.argv[2];
if (!planArg) {
  console.error('usage: node tools/mkchains.js <plan.json>');
  process.exit(1);
}
const d = JSON.parse(fs.readFileSync(planArg, 'utf8'));
const rep = d.repairs || [];

const chains = [];
let cur = null;
for (const l of d.playbook) {
  const jump = /^JUMP to (\S+)/.exec(l.start);
  if (!cur || jump) { if (cur) chains.push(cur); cur = { start: jump ? jump[1] : null, steps: [], covers: [] }; }
  if (jump) cur.steps.push('SEEK ' + jump[1]);
  for (const s of l.steps) cur.steps.push(s);
  cur.covers.push(...l.covers);
}
if (cur) chains.push(cur);

const fmtStep = (s) => {
  // old plan dumps carry a mojibake arrow (U+0393 U+00E5 U+00C6) instead of U+2192
  const p = s.replace(new RegExp('\\u0393\\u00e5\\u00c6|→', 'g'), '→').split(/\s*→\s*/);
  if (p.length !== 3) return s;
  const [head, act, land] = p;
  const dest = (/lands in (\S+)/.exec(land) || [])[1] || land;
  let action;
  if (/^CLICK:/.test(act)) action = 'CLICK "' + act.slice(7) + '"';
  else if (/segment group/.test(act)) action = 'let play (segment group)';
  else action = 'let it play';
  return head + ' → ' + action + ' → ' + dest;
};

const lines = [];
chains.forEach((c, i) => {
  lines.push(`chain ${i + 1} [covers: ${[...new Set(c.covers)].join(', ')}]`);
  lines.push('   ' + c.steps.map(fmtStep).join('  →  '));
});
lines.push('');
lines.push(`STATE SETUP - ${rep.length} of these. Run them 1 -> 7, setup 7 last (they start at 1A and wipe state flags, so the last one run decides the flag state later chains expect).`);
rep.forEach((r, i) => lines.push(`   setup ${i + 1} -> ends in ${r.into}: ` + r.steps.map(fmtStep).join('  →  ')));
const txt = lines.join('\n');

fs.writeFileSync(path.join(repo, 'tools', 'chains.txt'), txt);
fs.writeFileSync(path.join(repo, 'ROUTE.md'),
  '# bandersnatch 100% route\n\n' +
  d.summary.segmentsBefore + ' -> ' + d.summary.coveredAfter + ' / ' + d.summary.totalSegments +
  ' segments, ' + d.summary.choicePointsAfter + ' / ' + d.summary.totalChoicePoints + ' choice points.\n\n' +
  'A chain starts with SEEK (hash jump, writes no progress). Everything after the first hop is normal playback: watch until the listed timestamp, then either click the named choice or let it play. Timestamps are absolute video time.\n\n' +
  txt + '\n');
console.log('chains', chains.length, '-> ROUTE.md + tools/chains.txt');
