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
const segments = ctx.SegmentMap.segments;
const fmtMs = (v) => {
  const s = Math.round(v / 1000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(s % 60).padStart(2, '0');
};
function choiceMs(seg, label) {
  for (const m of bv.momentsBySegment[seg] || []) {
    if (!m.choices) continue;
    for (const c of m.choices) {
      if (((en[seg] && en[seg][c.id]) || c.text || c.id) === label) return m.startMs;
    }
  }
  return null;
}
// the same click can resolve to a whole segment group depending on the state flags, so keep
// every member around — when the route step stays unchecked the console can name the sibling
// the save actually got instead of just "needs X".
function choiceInfo(seg, label) {
  for (const m of bv.momentsBySegment[seg] || []) {
    if (!m.choices) continue;
    for (const c of m.choices) {
      if (((en[seg] && en[seg][c.id]) || c.text || c.id) !== label) continue;
      const group = c.sg && bv.segmentGroups[c.sg];
      return {
        sg: c.sg || null,
        // every member, including plain-string entries like "8KB" — filtering to
        // {segment} objects only silently dropped the string members and made the panel
        // report a later object member (0Cr4) as the landing
        members: group ? groupMembers(c.sg) : [],
      };
    }
  }
  return { sg: null, members: [] };
}

// two constraints on where a seek may land:
//  (a) scripts.js only treats a jump as a seek when it moves >= 2000ms — landing within 2s of
//      the outgoing segment makes the player run *its* transition instead (that is how a
//      3:32:03 -> 3:32:04 nudge sent ZQ's "pick up family photo" to 3AC2 at 59:12);
//  (b) an impression moment that starts inside the segment gets skipped if the seek lands on
//      or past it (momentStart(m, seeked=true) drops impressionData).
// choice-only moments are fine to land in: addChoices still runs, so the buttons appear.
function seekMs(seg) {
  const s = segments[seg];
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
  return t;
}
const splitArrows = (s) => s.replace(new RegExp('\\u0393\\u00e5\\u00c6|→', 'g'), '→').split(/\s*→\s*/);
const destOf = (land) => (/lands in (\S+)/.exec(land) || [])[1] || land.trim();

const fmtStep = (s) => {
  const p = splitArrows(s);
  if (p.length !== 3) return s;
  const [head, act, land] = p;
  const dest = destOf(land);
  const seg = head.split(/\s+/)[1] || '';
  let action;
  if (/do nothing/.test(act)) {
    action = /segment group/.test(act) ? 'let play (segment group)' : 'let it play';
  } else {
    const label = /^CLICK:/.test(act) ? act.slice(7) : act;
    const at = choiceMs(seg, label);
    action = 'CLICK "' + label + '"' + (at !== null ? ' [choice at ' + fmtMs(at) + ']' : '');
  }
  return head + ' → ' + action + ' → ' + dest;
};

// raw plan step -> structured row for route-data.js (the in-page route console)
function stepData(raw) {
  const sk = /^SEEK (\S+) at /.exec(raw);
  if (sk) return { k: 'seek', seg: sk[1], at: seekMs(sk[1]), head: 'SEEK ' + sk[1] + ' at ' + fmtMs(seekMs(sk[1])) };
  const p = splitArrows(raw);
  if (p.length !== 3) return null;
  const seg = p[0].trim().split(/\s+/)[1];
  if (!segments[seg]) return null;
  const row = { k: 'play', seg, at: seekMs(seg), head: p[0].trim(), into: destOf(p[2]) };
  if (!/do nothing/.test(p[1])) {
    const label = /^CLICK:/.test(p[1]) ? p[1].slice(7) : p[1];
    const info = choiceInfo(seg, label);
    row.k = 'click';
    row.label = label;
    row.choiceAt = choiceMs(seg, label);
    if (info.sg) {
      row.via = info.sg;
      row.group = info.members;
      row.siblings = info.members.map((m) => m.seg);
    }
  } else if (bv.segmentGroups[seg]) {
    // "let play" hops resolve the outgoing segment group of the segment you are leaving —
    // same flag gate as a group click, so the row gets the same members + a defaultNext
    // fallback for when nothing matches (the player then falls through to defaultNext).
    row.group = groupMembers(seg);
    row.siblings = row.group.map((m) => m.seg);
    row.fallback = segments[seg].defaultNext || null;
  }
  return row;
}

// same thing for a "let it play" hop: the player resolves the *outgoing* segment group of the
// segment you are leaving, so the row needs that group's members + preconditions too.
function groupMembers(key, depth) {
  depth = depth || 0;
  const raw = bv.segmentGroups[key];
  if (!raw || depth > 3) return [];
  const out = [];
  for (const m of raw) {
    if (m && m.segmentGroup) {
      // a nested group entry can carry its own precondition: the player checks it before
      // descending, so AND it onto every expanded member instead of dropping it
      const outer = m.precondition ? bv.preconditions[m.precondition] : null;
      for (const mm of groupMembers(m.segmentGroup, depth + 1)) {
        out.push({ seg: mm.seg, req: outer ? (mm.req ? ['and', outer, mm.req] : outer) : mm.req });
      }
    } else if (m && m.segment) out.push({ seg: m.segment, req: m.precondition ? bv.preconditions[m.precondition] : null });
    else if (typeof m === 'string') out.push({ seg: m, req: bv.preconditions[m] || null });
  }
  return out;
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
  if (jump) cur.steps.push('SEEK ' + jump[1] + ' at ' + fmtMs(seekMs(jump[1])));
  for (const s of l.steps) cur.steps.push(s);
  cur.covers.push(...l.covers);
}
if (cur) chains.push(cur);

const lines = [];
const chainsData = chains.map((c, i) => {
  lines.push(`chain ${i + 1} [covers: ${[...new Set(c.covers)].join(', ')}]`);
  lines.push('   ' + fmtSeq(c.steps).join('  →  '));
  return { n: i + 1, covers: [...new Set(c.covers)], steps: c.steps.map(stepData).filter(Boolean) };
});
lines.push('');
lines.push(`STATE SETUP - ${rep.length} of these. Run them 1 -> 7, setup 7 last (they start at 1A and wipe state flags, so the last one run decides the flag state later chains expect).`);
const setupsData = rep.map((r, i) => {
  const seg = r.steps[0].split(/\s*→\s*/)[0].split(/\s+/)[1];
  lines.push(`   setup ${i + 1} -> ends in ${r.into}: ` + fmtSeq(['SEEK ' + seg + ' at ' + fmtMs(seekMs(seg)), ...r.steps]).join('  →  '));
  return {
    n: i + 1,
    into: r.into,
    steps: [{ k: 'seek', seg, at: seekMs(seg), head: 'SEEK ' + seg + ' at ' + fmtMs(seekMs(seg)) },
      ...r.steps.map(stepData).filter(Boolean)],
  };
});
const txt = lines.join('\n');

fs.writeFileSync(path.join(repo, 'tools', 'chains.txt'), txt);
fs.writeFileSync(path.join(repo, 'ROUTE.md'),
  '# bandersnatch 100% route\n\n' +
  d.summary.segmentsBefore + ' -> ' + d.summary.coveredAfter + ' / ' + d.summary.totalSegments +
  ' segments, ' + d.summary.choicePointsAfter + ' / ' + d.summary.totalChoicePoints + ' choice points.\n\n' +
  'A chain starts with SEEK <segment> at <time> (hash jump, writes no progress). The seek time sits a few seconds INSIDE the segment: the first frame of a segment is also the last frame of the previous one, and seeking exactly there can make the player treat you as the outgoing segment and fire its choice. Same trap if a seek moves less than 2 seconds: scripts.js only counts a jump of >= 2000ms as a seek, so a 1s nudge runs the outgoing segment transition instead — always jump from far away, never nudge. Everything after the first hop is normal playback: watch until the listed timestamp, then either click the named choice or let it play. Timestamps are absolute video time and mark the **start of the segment** — then keep watching: the buttons appear later, at the `[choice at H:MM:SS]` marker (seeking straight to that moment would skip its state impression).\n\n' +
  txt + '\n');
fs.writeFileSync(path.join(repo, 'route-data.js'),
  '// generated by tools/mkchains.js from the planner output — do not edit by hand\n' +
  'window.ROUTE_DATA = ' + JSON.stringify({ summary: d.summary, chains: chainsData, setups: setupsData }) + ';\n');
console.log('chains', chainsData.length, 'setups', setupsData.length, '-> ROUTE.md + tools/chains.txt + route-data.js');
