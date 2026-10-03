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

// two constraints on where a seek may land:
//  (a) scripts.js only treats a jump as a seek when it moves >= 2000ms — landing within 2s of
//      the outgoing segment makes the player run *its* transition instead (that is how a
//      3:32:03 -> 3:32:04 nudge sent ZQ's "pick up family photo" to 3AC2 at 59:12);
//  (b) an impression moment that starts inside the segment gets skipped if the seek lands on
//      or past it (momentStart(m, seeked=true) drops impressionData).
// choice-only moments are fine to land in: addChoices still runs, so the buttons appear.
function seekTime(seg) {
  const s = ctx.SegmentMap.segments[seg];
  const start = s.startTimeMs;
  let t = start + 3000;
  for (const m of bv.momentsBySegment[seg] || []) {
    if (m.startMs <= start || !m.impressionData) continue;
    if (m.startMs - 500 < t) t = m.startMs - 500;
  }
  if (t < start + 2000) {
    console.error(`WARN ${seg}: seek ${fmtMs(t)} is under 2s past the segment start — jump in from somewhere far away or the outgoing segment will fire its transition`);
  }
  if (s.endTimeMs) t = Math.min(t, s.endTimeMs - 1000);
  return fmtMs(t);
}

// raw plan steps are "HH:MM:SS SEG → action → dest"; the head is the segment start, but the
// line opens with the seek time, so keep them in sync instead of showing two different times.
function fmtSeq(raw) {
  const out = raw.map(fmtStep);
  const sk = /^SEEK (\S+) at (\S+)$/.exec(raw[0] || '');
  if (sk && raw[1]) {
    const head = raw[1].split(/\s*→\s*/)[0];
    if (head.split(/\s+/)[1] === sk[1]) out[1] = out[1].replace(head, head.replace(/^\S+/, sk[2]));
  }
  return out;
}

const chains = [];
let cur = null;
for (const l of d.playbook) {
  const jump = /^JUMP to (\S+)/.exec(l.start);
  if (!cur || jump) { if (cur) chains.push(cur); cur = { start: jump ? jump[1] : null, steps: [], covers: [] }; }
  if (jump) cur.steps.push('SEEK ' + jump[1] + ' at ' + seekTime(jump[1]));
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
  lines.push('   ' + fmtSeq(c.steps).join('  →  '));
});
lines.push('');
lines.push(`STATE SETUP - ${rep.length} of these. Run them 1 -> 7, setup 7 last (they start at 1A and wipe state flags, so the last one run decides the flag state later chains expect).`);
rep.forEach((r, i) => {
  const seg = r.steps[0].split(/\s*→\s*/)[0].split(/\s+/)[1];
  lines.push(`   setup ${i + 1} -> ends in ${r.into}: ` + fmtSeq(['SEEK ' + seg + ' at ' + seekTime(seg), ...r.steps]).join('  →  '));
});
const txt = lines.join('\n');

fs.writeFileSync(path.join(repo, 'tools', 'chains.txt'), txt);
fs.writeFileSync(path.join(repo, 'ROUTE.md'),
  '# bandersnatch 100% route\n\n' +
  d.summary.segmentsBefore + ' -> ' + d.summary.coveredAfter + ' / ' + d.summary.totalSegments +
  ' segments, ' + d.summary.choicePointsAfter + ' / ' + d.summary.totalChoicePoints + ' choice points.\n\n' +
  'A chain starts with SEEK <segment> at <time> (hash jump, writes no progress). The seek time sits a few seconds INSIDE the segment: the first frame of a segment is also the last frame of the previous one, and seeking exactly there can make the player treat you as the outgoing segment and fire its choice. Same trap if a seek moves less than 2 seconds: scripts.js only counts a jump of >= 2000ms as a seek, so a 1s nudge runs the outgoing segment transition instead — always jump from far away, never nudge. Everything after the first hop is normal playback: watch until the listed timestamp, then either click the named choice or let it play. Timestamps are absolute video time and mark the **start of the segment** — then keep watching: the buttons appear later, at the `[choice at H:MM:SS]` marker (seeking straight to that moment would skip its state impression).\n\n' +
  txt + '\n');
console.log('chains', chains.length, '-> ROUTE.md + tools/chains.txt');
