const fs = require('fs');
const vm = require('vm');
const path = require('path');

const repo = path.resolve(__dirname, '..');
const lsArg = process.argv[2];
if (!lsArg) {
  console.error('usage: node tools/route-planner.js <localStorage-dump.json> > plan.json');
  console.error('dump it from the real save on http://127.0.0.1:8000 (see AGENTS.md)');
  process.exit(1);
}
const ls0 = JSON.parse(fs.readFileSync(lsArg, 'utf8'));

const ctx = { console, JSON, Math, Object, Array };
vm.createContext(ctx);
for (const f of ['assets/SegmentMap.js', 'assets/bandersnatch.js', 'assets/choices/en.js']) {
  vm.runInContext(fs.readFileSync(`${repo}/${f}`, 'utf8'), ctx, { filename: f });
}
const sm = ctx.SegmentMap;
const bv = ctx.bandersnatch.videos['80988062'].interactiveVideoMoments.value;
const mb = bv.momentsBySegment;
const choicePoints = bv.choicePointNavigatorMetadata.choicePointsMetadata.choicePoints;
const segmentGroups = bv.segmentGroups;
const preconds = bv.preconditions;
const en = ctx.en || {};
const allSegs = Object.keys(sm.segments);
const MAXEXP = process.env.MAXEXP ? Number(process.env.MAXEXP) : 400000;
const allStateKeys = Object.keys(bv.stateHistory);

// ---------- state ----------
const relevant = new Set();
(function walk(c) { if (Array.isArray(c)) { if (c[0] === 'persistentState') relevant.add(c[1]); else c.forEach(walk); } })(Object.values(preconds));
const relKeys = [...relevant];

function mkState(src) {
  const s = {};
  for (const k of allStateKeys) {
    const raw = src['persistentState_' + k];
    s[k] = raw !== undefined ? JSON.parse(raw) : bv.stateHistory[k];
  }
  return s;
}
function evIn(c, st) {
  if (c === true || c === false) return c;
  if (typeof c === 'string') return c;
  if (Array.isArray(c)) {
    switch (c[0]) {
      case 'persistentState': return st[c[1]];
      case 'not': return !evIn(c[1], st);
      case 'and': return c.slice(1).every((x) => evIn(x, st));
      case 'or': return c.slice(1).some((x) => evIn(x, st));
      case 'eql': return evIn(c[1], st) == evIn(c[2], st);
      default: return true;
    }
  }
  return true;
}
const evLookupIn = (id, st) => (preconds[id] === undefined ? true : evIn(preconds[id], st));
const evMomentIn = (c, st) => (c === undefined || c === null ? true : Array.isArray(c) ? evIn(c, st) : typeof c === 'string' ? c.length > 0 : !!c);
function resolveGroupIn(g, st, d = 0) {
  if (d > 10) return null;
  const list = segmentGroups[g];
  if (!list) return null;
  const results = [];
  for (const v of list) {
    const isObj = v && typeof v === 'object';
    if (isObj && v.precondition !== undefined && v.precondition !== null && !evLookupIn(v.precondition, st)) continue;
    if (isObj && v.segmentGroup) results.push(resolveGroupIn(v.segmentGroup, st, d + 1));
    else if (isObj && v.segment) results.push(v.segment);
    else { const id = isObj ? v.id : v; if (!evLookupIn(id, st)) continue; results.push(isObj ? v.segment || v.id : v); }
  }
  return results[0];
}
function applyImp(st, imp) {
  if (!imp || imp.type !== 'userState' || !imp.data || !imp.data.persistent) return false;
  let ch = false;
  for (const [k, v] of Object.entries(imp.data.persistent)) if (st[k] !== v) { st[k] = v; ch = true; }
  return ch;
}
const keyOf = (st) => relKeys.map((k) => st[k]).join('|');

// ---------- static structures ----------
const groupMembers = {};
const build = function (g, d = 0) {
  if (d > 12) return [];
  const l = segmentGroups[g];
  if (!l) return [];
  const out = [];
  for (const v of l) {
    if (v && typeof v === 'object') {
      if (v.segmentGroup) out.push(...build(v.segmentGroup, d + 1));
      else if (v.segment) out.push(v.segment);
      else if (v.id) out.push(v.id);
    } else out.push(v);
  }
  groupMembers[g] = out;
  return out;
};
for (const g of Object.keys(segmentGroups)) build(g);

// dynamic candidate sources per target
const defSrc = {}, chSrc = {}, grpSrc = {};
const addSrc = (m, x, e) => { (m[x] = m[x] || []).push(e); };
for (const P of allSegs) {
  const s = sm.segments[P];
  if (s.defaultNext) addSrc(defSrc, s.defaultNext, { from: P });
  for (const m of mb[P] || []) {
    if (!m.choices) continue;
    m.choices.forEach((c, idx) => {
      if (c.segmentId) addSrc(chSrc, c.segmentId, { from: P, m, idx });
      else if (c.sg) for (const t of (groupMembers[c.sg] || [])) addSrc(grpSrc, t, { from: P, g: c.sg, m, idx });
    });
  }
  if (segmentGroups[P]) for (const t of (groupMembers[P] || [])) addSrc(grpSrc, t, { from: P, g: P, kind: 'selfgroup' });
}
function natYields(P, X, st) {
  const s = sm.segments[P];
  const cm = [];
  for (const m of mb[P] || []) if (evMomentIn(m.precondition, st) && m.choices) cm.push(m);
  let nat = null;
  if (cm.length) {
    const last = cm.slice().sort((a, b) => b.endMs - a.endMs)[0];
    if (s.endTimeMs && last.endMs >= s.endTimeMs - 1 && typeof last.defaultChoiceIndex === 'number') {
      const dc = last.choices[last.defaultChoiceIndex];
      if (dc) nat = dc.segmentId || (dc.sg ? resolveGroupIn(dc.sg, st) : null);
    }
  }
  if (!nat && segmentGroups[P]) nat = resolveGroupIn(P, st);
  if (!nat && s.defaultNext) nat = s.defaultNext;
  return nat === X;
}
function canEnter(X, st) {
  for (const e of (defSrc[X] || [])) if (natYields(e.from, X, st)) return true;
  for (const e of (chSrc[X] || [])) if (evMomentIn(e.m.precondition, st)) return true;
  for (const e of (grpSrc[X] || [])) {
    if (e.m && !evMomentIn(e.m.precondition, st)) continue;
    if (resolveGroupIn(e.g, st) === X) return true;
  }
  return false;
}

// ---------- edges ----------
function outsFor(seg, st) {
  const out = [];
  const s = sm.segments[seg];
  const seen = new Set();
  const cm = [];
  for (const m of mb[seg] || []) {
    if (!evMomentIn(m.precondition, st) || !m.choices) continue;
    cm.push(m);
    m.choices.forEach((c, idx) => {
      const to = c.segmentId || (c.sg ? resolveGroupIn(c.sg, st) : null);
      if (!to) return;
      out.push({ to, kind: 'choice', label: (en[seg] && en[seg][c.id]) || c.text || c.id, idx, imp: c.impressionData || null, m });
      seen.add(to);
    });
  }
  let nat = null, natLabel = '', natImp = null;
  if (cm.length) {
    const last = cm.slice().sort((a, b) => b.endMs - a.endMs)[0];
    if (s.endTimeMs && last.endMs >= s.endTimeMs - 1 && typeof last.defaultChoiceIndex === 'number') {
      const dc = last.choices[last.defaultChoiceIndex];
      if (dc) { const to = dc.segmentId || (dc.sg ? resolveGroupIn(dc.sg, st) : null); if (to) { nat = to; natImp = dc.impressionData || null; natLabel = `(do nothing → "${(en[seg] && en[seg][dc.id]) || dc.text || dc.id}")`; } }
    }
  }
  if (!nat && segmentGroups[seg]) { const g = resolveGroupIn(seg, st); if (g) { nat = g; natLabel = '(do nothing — segment group)'; } }
  if (!nat && s.defaultNext) { nat = s.defaultNext; natLabel = '(do nothing — let it play)'; }
  if (nat && !out.some((o) => o.to === nat)) out.push({ to: nat, kind: 'default', label: natLabel, idx: -1, imp: natImp, m: null });
  return out.filter((o) => o.to);
}
function playImpressions(seg, st, natural) {
  const start = sm.segments[seg].startTimeMs;
  for (const m of mb[seg] || []) {
    if (!evMomentIn(m.precondition, st)) continue;
    if (!natural && m.startMs <= start) continue;
    applyImp(st, m.impressionData);
  }
}
function startImpressions(seg, st) {
  const start = sm.segments[seg].startTimeMs;
  for (const m of mb[seg] || []) { if (evMomentIn(m.precondition, st) && m.startMs <= start) applyImp(st, m.impressionData); }
}

// ---------- coverage ----------
const covered = new Set();
const bc = {};
for (const [k, v] of Object.entries(ls0)) { if (!k.startsWith('breadcrumb_')) continue; bc[k.slice(11)] = v; covered.add(k.slice(11)); if (v) covered.add(v); }
let fresh = new Set(allSegs.filter((s) => !covered.has(s)));
const TARGET = process.argv[2] || null;
if (TARGET) {
  if (!fresh.has(TARGET)) { console.log(JSON.stringify({ alreadyCovered: TARGET, summary: { segmentsBefore: allSegs.length - fresh.size } })); process.exit(0); }
  fresh = new Set([TARGET]);
}
const fresh0 = new Set(fresh);

const rev = {};
{
  const link = (x, from) => { (rev[x] = rev[x] || []).push(from); };
  for (const X of Object.keys(defSrc)) for (const e of defSrc[X]) link(X, e.from);
  for (const X of Object.keys(chSrc)) for (const e of chSrc[X]) link(X, e.from);
  for (const X of Object.keys(grpSrc)) for (const e of grpSrc[X]) link(X, e.from);
}
const hdist = {};
{
  const q = [];
  for (const s of fresh) { hdist[s] = 0; q.push(s); }
  while (q.length) { const x = q.shift(); for (const p of (rev[x] || [])) if (hdist[p] === undefined) { hdist[p] = hdist[x] + 1; q.push(p); } }
}

const fmt = (ms) => { const s = Math.floor(ms / 1000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60; return h ? `${h}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}` : `${m}:${String(ss).padStart(2, '0')}`; };
const dur = (seg) => { const s = sm.segments[seg]; return s.endTimeMs ? s.endTimeMs - s.startTimeMs : 5000; };

const enabledCache = new Map();
function enabledCount(st) {
  const k = keyOf(st);
  if (enabledCache.has(k)) return enabledCache.get(k);
  let n = 0;
  for (const X of fresh) if (canEnter(X, st)) n++;
  enabledCache.set(k, n);
  return n;
}

// ---------- dijkstra ----------
function pqPush(q, item) {
  q.push(item);
  let i = q.length - 1;
  while (i > 0) { const p = (i - 1) >> 1; if (q[p].c <= q[i].c) break; [q[p], q[i]] = [q[i], q[p]]; i = p; }
}
function pqPop(q) {
  const top = q[0], last = q.pop();
  if (q.length) { q[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < q.length && q[l].c < q[m].c) m = l; if (r < q.length && q[r].c < q[m].c) m = r; if (m === i) break; [q[m], q[i]] = [q[i], q[m]]; i = m; } }
  return top;
}
function search(startSeg, st0, allowJump, extraGoal) {
  const q = [];
  const seen = new Map();
  const push = (seg, s, path, cost, isJump) => {
    const k = seg + '#' + keyOf(s) + (isJump ? 'J' : '');
    const prev = seen.get(k);
    if (prev !== undefined && prev <= cost) return;
    seen.set(k, cost);
    pqPush(q, { seg, s, path, cost, isJump, c: cost + (hdist[seg] || 0) });
  };
  const baseEnabled = enabledCount(st0);
  if (allowJump) for (const seg of allSegs) push(seg, st0, [], 0, true);
  else push(startSeg, st0, [], 0, false);
  let expanded = 0;
  while (q.length && expanded < MAXEXP) {
    const n = pqPop(q);
    expanded++;
    for (const e of outsFor(n.seg, n.s)) {
      const s2 = { ...n.s };
      playImpressions(n.seg, s2, !n.isJump);
      applyImp(s2, e.imp);
      startImpressions(e.to, s2);
      const step = { from: n.seg, label: e.label, kind: e.kind, to: e.to, imp: e.imp || null };
      const path = [...n.path, step];
      let cost = n.cost + 1;
      if (fresh.has(e.to)) return { path, st: s2, cost };
      if (extraGoal && extraGoal(s2)) return { path, st: s2, cost, repair: true };
      push(e.to, s2, path, cost, false);
    }
  }
  return null;
}

function applyPath(path, s, firstNatural) {
  const got = [];
  for (let i = 0; i < path.length; i++) {
    const step = path[i];
    playImpressions(step.from, s, i > 0 || firstNatural);
    applyImp(s, step.imp);
    const fT = fresh.has(step.to), fF = fresh.has(step.from);
    startImpressions(step.to, s);
    if (fT) {
      fresh.delete(step.to); bc[step.to] = step.from; covered.add(step.to); got.push(step.to);
      if (fF) { fresh.delete(step.from); covered.add(step.from); got.push(step.from); }
    }
  }
  return got;
}

let st = mkState(ls0);
let curSeg = (ls0.place || '').replace('#', '').split('/')[0];
if (!sm.segments[curSeg]) curSeg = null;
const trips = [];
const repairs = [];
let stuckDiag = null;
let jumps = 0;
let guard = 0;
while (fresh.size && guard++ < 600) {
  enabledCache.clear();
  const attempts = [[curSeg, false], [null, true]];
  let found = null, jumped = false;
  for (const [sg, aj] of attempts) {
    if (sg === null && aj === false) continue;
    if (sg && !aj) { if (!sm.segments[sg]) continue; }
    enabledCache.clear();
    found = search(sg, st, aj);
    jumped = aj;
    if (found) break;
  }
  if (!found) {
    const base = enabledCount(st);
    enabledCache.clear();
    const rep = search(null, st, true, (s2) => enabledCount(s2) > base);
    if (rep && rep.path.length && enabledCount(rep.st) > base) {
      applyPath(rep.path, st, false);
      curSeg = rep.path[rep.path.length - 1].to;
      repairs.push({ base, after: enabledCount(st), into: curSeg, steps: rep.path.map((x) => `${fmt(sm.segments[x.from].startTimeMs)}  ${x.from}  →  ${x.label}  →  lands in ${x.to}`) });
      if (repairs.length > 40) { stuckDiag = { reason: 'too many repairs' }; break; }
      continue;
    }
    stuckDiag = { stuckAt: curSeg, guard, enabled: enabledCount(st), freshLeft: fresh.size, enterableNow: [...fresh].filter((x) => canEnter(x, st)) };
    break;
  }
  if (jumped) jumps++;
  const newly = applyPath(found.path, st, !jumped);
  curSeg = found.path.length ? found.path[found.path.length - 1].to : curSeg;
  trips.push({
    jump: jumped, start: found.path[0].from, cost: found.cost,
    watchMs: found.path.reduce((a, x) => a + dur(x.from), 0),
    covered: newly,
    steps: found.path.map((x) => ({ at: fmt(sm.segments[x.from].startTimeMs), seg: x.from, do: x.kind === 'choice' ? `CLICK: ${x.label}` : x.label, into: x.to })),
  });
  if (!newly.length) break;
}

const still = [...fresh];
const stateChanged = allStateKeys.filter((k) => JSON.stringify(st[k]) !== JSON.stringify(bv.stateHistory[k])).length;
let tc = 0, rc = 0;
for (const s in mb) for (const m of mb[s] || []) { if (m.choices && m.choices.length) { tc++; if (m.id && choicePoints[m.id] && covered.has(s)) rc++; } }

console.log(JSON.stringify({
  repairs,
  playbook: trips.map((t, i) => ({
    leg: i + 1,
    start: t.jump ? `JUMP to ${t.start} (seek to ${fmt(sm.segments[t.start].startTimeMs)})` : `you are at ${t.start}`,
    steps: t.steps.map((s) => `${s.at}  ${s.seg}  →  ${s.do}  →  lands in ${s.into}`),
    covers: t.covered,
  })),
  stuck: stuckDiag,
  summary: {
    segmentsBefore: allSegs.length - fresh0.size, totalSegments: allSegs.length,
    trips: trips.length, jumps,
    coveredAfter: covered.size, stillFresh: still.length, stillFreshList: still,
    choicePointsAfter: rc, totalChoicePoints: tc,
    statesChangedAfter: stateChanged, totalStates: allStateKeys.length,
    totalWatchMs: trips.reduce((a, t) => a + t.watchMs, 0),
  },
  trips: trips.map((t, i) => ({ trip: i + 1, jump: t.jump, watch: fmt(t.watchMs), covered: t.covered, steps: t.steps })),
}, null, 1));
