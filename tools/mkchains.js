const fs = require('fs');
const path = require('path');
const vm = require('vm');

const repo = path.resolve(__dirname, '..');
const planArg = process.argv[2];
if (!planArg) {
  console.error('usage: node tools/mkchains.js <plan.json>');
  process.exit(1);
}
const d = JSON.parse(fs.readFileSync(planArg, 'utf8'));
const rep = d.repairs || [];

// choice windows: steps are stamped with the segment start (seeking straight to the
// choice would skip its state impression), so say when the buttons actually appear.
const ctx = { console, JSON, Math, Object, Array };
vm.createContext(ctx);
for (const f of ['assets/SegmentMap.js', 'assets/bandersnatch.js', 'assets/choices/en.js']) {
  vm.runInContext(fs.readFileSync(path.join(repo, f), 'utf8'), ctx, { filename: f });
}
const bv = ctx.bandersnatch.videos['80988062'].interactiveVideoMoments.value;
const en = ctx.en || {};
const fmtMs = (v) => {
  const s = Math.round(v / 1000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(s % 60).padStart(2, '0');
};
function choiceAt(seg, label) {
  for (const m of bv.momentsBySegment[seg] || []) {
    if (!m.choices) continue;
    for (const c of m.choices) {
      if (((en[seg] && en[seg][c.id]) || c.text || c.id) === label) return fmtMs(m.startMs);
    }
  }
  return null;
}

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
  const seg = head.split(/\s+/)[1] || '';
  let action;
  if (/do nothing/.test(act)) {
    action = /segment group/.test(act) ? 'let play (segment group)' : 'let it play';
  } else {
    const label = /^CLICK:/.test(act) ? act.slice(7) : act;
    const at = choiceAt(seg, label);
    action = 'CLICK "' + label + '"' + (at ? ' [choice at ' + at + ']' : '');
  }
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
  'A chain starts with SEEK (hash jump, writes no progress). Everything after the first hop is normal playback: watch until the listed timestamp, then either click the named choice or let it play. Timestamps are absolute video time and mark the **start of the segment** — seek there, then keep watching: the buttons appear later, at the `[choice at H:MM:SS]` marker (seeking straight to that moment would skip its state impression).\n\n' +
  txt + '\n');
console.log('chains', chains.length, '-> ROUTE.md + tools/chains.txt');
