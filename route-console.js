// route console — in-page list of every chain + setup from route-data.js
// toggle with C, jump to the next pending step with N
// steps are clickable: they seek the player (a seek writes no progress, it just moves you)
(function () {
  'use strict';

  const RC_VERSION = '2026-10-07.13';
  const DATA = window.ROUTE_DATA;
  const root = document.createElement('div');
  root.id = 'rc-root';
  root.innerHTML =
    '<button id="rc-fab" title="Route console (C)"><span class="rc-fab-dot"></span>route</button>' +
    '<aside id="rc-panel">' +
    '  <header>' +
    '    <div class="rc-title">route console</div>' +
    '    <button id="rc-close" title="hide (C)">&times;</button>' +
    '  </header>' +
    '  <div id="rc-stats"></div>' +
    '  <div id="rc-bar"><i></i></div>' +
    '  <div id="rc-actions">' +
    '    <button data-filter="all" class="rc-on">all</button>' +
    '    <button data-filter="pending">pending</button>' +
    '    <button data-filter="done">done</button>' +
    '    <button id="rc-next" title="jump to the next pending step (N)">next &rarr;</button>' +
    '  </div>' +
    '  <div id="rc-do" title="click to dismiss"></div>' +
    '  <div id="rc-list"></div>' +
    '  <footer><kbd>C</kbd> hide &middot; <kbd>N</kbd> jump to next &middot; click any step to jump &middot; build <span id="rc-v"></span></footer>' +
    '</aside>' +
    '<div id="rc-toast"></div>';
  document.body.appendChild(root);
  root.querySelector('#rc-v').textContent = RC_VERSION;

  const style = document.createElement('style');
  style.textContent = [
    '#rc-root{position:fixed;inset:0;pointer-events:none;z-index:2147483000;font:12px/1.45 Consolas,Menlo,monospace}',
    '#rc-root *{box-sizing:border-box}',
    '#rc-fab{position:fixed;left:14px;top:14px;pointer-events:auto;display:flex;align-items:center;gap:8px;',
    ' padding:9px 16px;border:1px solid #2ee6a8;border-radius:999px;background:rgba(6,20,16,.92);color:#2ee6a8;',
    ' font:600 13px/1 Consolas,monospace;cursor:pointer;box-shadow:0 6px 24px rgba(0,0,0,.55);transition:transform .25s cubic-bezier(.2,.9,.3,1.4),box-shadow .25s}',
    '#rc-fab:hover{transform:translateY(-2px) scale(1.05);box-shadow:0 10px 30px rgba(46,230,168,.35)}',
    '#rc-fab .rc-fab-dot{width:8px;height:8px;border-radius:50%;background:#2ee6a8;animation:rc-pulse 1.8s ease-in-out infinite}',
    '@keyframes rc-pulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.55);opacity:.45}}',
    '#rc-panel{position:fixed;left:0;top:0;bottom:0;width:392px;max-width:92vw;pointer-events:auto;display:flex;flex-direction:column;',
    ' background:linear-gradient(180deg,rgba(7,17,15,.97),rgba(4,10,9,.985));color:#cfe9e0;border-right:1px solid #1c4d41;',
    ' box-shadow:12px 0 40px rgba(0,0,0,.6);transform:translateX(0);transition:transform .32s cubic-bezier(.3,.9,.25,1)}',
    '#rc-root.rc-hidden #rc-panel{transform:translateX(-102%)}',
    '#rc-root.rc-hidden #rc-fab{animation:rc-in .3s ease}',
    '@keyframes rc-in{from{transform:translateX(-16px);opacity:0}to{transform:none;opacity:1}}',
    '#rc-panel header{display:flex;align-items:center;justify-content:space-between;padding:14px 14px 8px}',
    '.rc-title{font-size:14px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#2ee6a8}',
    '#rc-close{background:none;border:0;color:#6d8f86;font-size:22px;line-height:1;cursor:pointer;transition:transform .2s,color .2s}',
    '#rc-close:hover{color:#ff6b6b;transform:rotate(90deg)}',
    '#rc-stats{padding:0 14px 6px;color:#9fc3b9;display:grid;gap:3px}',
    '#rc-stats b{color:#fff;font-weight:700}',
    '#rc-stats .rc-ok{color:#2ee6a8}',
    '#rc-bar{margin:4px 14px 8px;height:6px;background:#0e2621;border-radius:99px;overflow:hidden}',
    '#rc-bar i{display:block;height:100%;width:0;border-radius:99px;background:linear-gradient(90deg,#2ee6a8,#7CFFB2);transition:width .6s cubic-bezier(.3,.9,.25,1)}',
    '#rc-actions{display:flex;gap:6px;padding:0 14px 10px;flex-wrap:wrap}',
    '#rc-actions button{background:#0e2621;border:1px solid #1c4d41;color:#8fb3aa;border-radius:6px;padding:5px 10px;cursor:pointer;',
    ' font:600 11px/1 Consolas,monospace;text-transform:lowercase;transition:all .18s}',
    '#rc-actions button:hover{border-color:#2ee6a8;color:#2ee6a8;transform:translateY(-1px)}',
    '#rc-actions button.rc-on{background:#123b33;border-color:#2ee6a8;color:#2ee6a8}',
    '#rc-next{margin-left:auto}',
    // fix-chip banner: what a "fix p_x" button sends you to do
    '#rc-do{display:none;margin:0 14px 8px;padding:8px 10px;border:1px solid #2ee6a8;border-radius:6px;',
    ' background:rgba(14,44,36,.92);color:#eafff8;font-size:11px;line-height:1.55;cursor:pointer}',
    '#rc-do.rc-on{display:block;animation:rc-pop .35s cubic-bezier(.2,.9,.3,1.4)}',
    '#rc-do.rc-nuclear{border-color:#ff6b6b;background:rgba(64,14,14,.94);color:#ffd7d7}',
    '#rc-do.rc-nofit{border-color:#ff6b6b;background:rgba(64,14,14,.94);color:#ffd7d7;animation:rc-shake .4s}',
    '#rc-do .rc-reject{padding:3px 0;border-top:1px dashed rgba(255,107,107,.35);color:#ffc9c9}',
    '#rc-do .rc-first{padding:2px 0 6px;color:#ffd98a;font-weight:700}',
    '#rc-do .rc-first span{color:#8fb3aa;font-weight:400}',
    '@keyframes rc-shake{0%,100%{transform:none}25%{transform:translateX(-4px)}75%{transform:translateX(4px)}}',
    '#rc-do b{color:#7CFFB2}#rc-do .rc-warn{color:#ff6b6b}',
    '#rc-do i{color:#8fb3aa;font-style:normal}',
    // fix chips on the red "needs …" rows: click one and the banner above tells you the stop
    '.rc-fix{background:#3a2b12;border:1px solid #b98b2e;color:#ffd98a;border-radius:5px;padding:0 6px;margin:0 0 0 3px;',
    ' cursor:pointer;font:inherit;font-size:10px;letter-spacing:.02em;transition:all .18s cubic-bezier(.2,.9,.3,1.4)}',
    '.rc-fix:hover{background:#54401a;transform:translateY(-2px);box-shadow:0 3px 10px rgba(255,190,80,.4)}',
    '.rc-fix:active{transform:translateY(0) scale(.92)}',
    '.rc-goto{background:#123b33;border:1px solid #2ee6a8;color:#2ee6a8;border-radius:5px;padding:0 6px;margin:0 0 0 3px;',
    ' cursor:pointer;font:inherit;font-size:10px;transition:all .18s cubic-bezier(.2,.9,.3,1.4)}',
    '.rc-goto:hover{transform:translateY(-2px);box-shadow:0 3px 10px rgba(46,230,168,.4)}',
    '.rc-nostop{color:#8a6d3b;text-decoration:underline dotted;cursor:help}',
    '#rc-list{flex:1;overflow-y:auto;padding:0 10px 14px}',
    '#rc-list::-webkit-scrollbar{width:8px}#rc-list::-webkit-scrollbar-thumb{background:#1c4d41;border-radius:8px}',
    'details.rc-item{border:1px solid #133630;border-radius:8px;margin-bottom:6px;background:rgba(10,26,22,.6);overflow:hidden;transition:border-color .25s,background .25s}',
    'details.rc-item:hover{border-color:#2ee6a8}',
    'details.rc-item.rc-done{border-color:#1c6b53;background:rgba(14,44,36,.75)}',
    'details.rc-item[open]{background:rgba(12,32,27,.92)}',
    'details.rc-item>summary{cursor:pointer;padding:8px 10px;display:flex;align-items:center;gap:8px;list-style:none;user-select:none}',
    'details.rc-item>summary::-webkit-details-marker{display:none}',
    '.rc-mark{width:16px;height:16px;flex:0 0 16px;border-radius:50%;border:1.5px solid #2c5c52;display:grid;place-items:center;',
    ' font-size:11px;color:transparent;transition:all .3s cubic-bezier(.3,.9,.3,1.4)}',
    '.rc-mark.rc-hit{background:#2ee6a8;border-color:#2ee6a8;color:#04140f;animation:rc-pop .45s cubic-bezier(.2,.9,.3,1.5)}',
    '@keyframes rc-pop{0%{transform:scale(.3) rotate(-25deg);opacity:.2}60%{transform:scale(1.25) rotate(8deg)}100%{transform:scale(1) rotate(0)}}',
    '.rc-name{font-weight:700;color:#eafff8;white-space:nowrap}',
    '.rc-meta{color:#6d8f86;font-size:11px;margin-left:auto;white-space:nowrap;min-width:0;max-width:58%;overflow:hidden;text-overflow:ellipsis}',
    '.rc-covers{padding:0 10px 8px 34px;color:#6d8f86;font-size:11px}',
    '.rc-covers span{color:#2ee6a8}',
    'ol.rc-steps{margin:0 0 8px;padding:0 8px 0 34px;list-style:none;display:grid;gap:3px}',
    // two rows per step: [mark][time][why] over [mark][label spanning both text columns],
    // so a long label never squeezes the red "needs …" against the panel edge
    'li.rc-step{display:grid;grid-template-columns:16px 70px minmax(0,1fr);grid-template-areas:"mark time why" "mark label label";',
    ' column-gap:8px;row-gap:3px;align-items:start;padding:6px 7px;border-radius:6px;cursor:pointer;',
    ' border:1px solid transparent;transition:background .18s,border-color .18s,transform .18s}',
    'li.rc-step:hover{background:#0f332c;border-color:#1c6b53;transform:translateX(3px)}',
    'li.rc-step .rc-mark{grid-area:mark;align-self:start;margin-top:2px}',
    'li.rc-step .rc-t{grid-area:time;color:#8fb3aa;white-space:nowrap}',
    'li.rc-step .rc-b{grid-area:label;color:#eafff8;min-width:0;overflow-wrap:anywhere}',
    'li.rc-step .rc-b em{color:#2ee6a8;font-style:normal}',
    'li.rc-step .rc-b i{color:#6d8f86;font-style:normal}',
    'li.rc-step.rc-step-done .rc-b{color:#5c7d75;text-decoration:line-through;text-decoration-color:#1c6b53}',
    'li.rc-step.rc-step-done .rc-mark{background:#2ee6a8;border-color:#2ee6a8;color:#04140f;animation:rc-pop .45s cubic-bezier(.2,.9,.3,1.5)}',
    'li.rc-step .rc-why{grid-area:why;justify-self:end;text-align:right;color:#ff6b6b;font-size:11px;max-width:100%;animation:rc-blink .9s ease-in-out infinite}',
    'li.rc-step.rc-step-done .rc-why{display:none}',
    '@keyframes rc-blink{0%,100%{opacity:1}50%{opacity:.35}}',
    '.rc-meta .rc-need{color:#ff6b6b}',
    '#rc-stats .rc-live{color:#2ee6a8;font-size:11px;letter-spacing:.03em}',
    '#rc-panel footer{padding:8px 14px;border-top:1px solid #133630;color:#5c7d75;font-size:11px}',
    '#rc-panel footer kbd{background:#0e2621;border:1px solid #1c4d41;border-radius:4px;padding:1px 5px}',
    '#rc-toast{position:fixed;left:50%;bottom:74px;transform:translate(-50%,20px);opacity:0;pointer-events:none;background:rgba(6,20,16,.96);',
    ' border:1px solid #2ee6a8;color:#eafff8;padding:10px 16px;border-radius:8px;font:12px/1.4 Consolas,monospace;',
    ' box-shadow:0 8px 30px rgba(0,0,0,.6);transition:opacity .25s,transform .25s;z-index:2147483600;max-width:70vw}',
    '#rc-toast.rc-show{opacity:1;transform:translate(-50%,0)}',
    '#rc-toast.rc-err{border-color:#ff6b6b;color:#ffd7d7}',
  ].join('');
  document.head.appendChild(style);

  const list = root.querySelector('#rc-list');
  const stats = root.querySelector('#rc-stats');
  const bar = root.querySelector('#rc-bar i');
  const toastEl = root.querySelector('#rc-toast');
  let filter = 'all';
  let prevChainDone = new Set();
  let prevStepDone = new Set();
  let toastTimer = 0;
  let lastErr = '';

  function toast(msg, err) {
    toastEl.textContent = msg;
    toastEl.classList.toggle('rc-err', !!err);
    toastEl.classList.add('rc-show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('rc-show'), 3200);
    if (err) console.error('[route-console] ' + msg);
  }

  function coveredSet() {
    const out = new Set();
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith('breadcrumb_')) continue;
      out.add(k.slice('breadcrumb_'.length));
      const src = localStorage.getItem(k);
      if (src) out.add(src);
    }
    return out;
  }

  // why a chain can tick every step yet show N/M: a seek target only enters the save
  // as the first-entry VALUE of the segment you land from it, and breadcrumb values are
  // write-once — if that segment was first entered elsewhere (chain 14: R1 came from 5QA),
  // the planned value-write is frozen out forever. a later chain landing something fresh
  // FROM the seek target still counts it. name the real culprit instead of a bare 2/3.
  function staleSeekWhy(seg, nextSeg, covered) {
    if (!nextSeg || !covered.has(nextSeg)) return '';
    const came = localStorage.getItem('breadcrumb_' + nextSeg);
    if (!came || came === seg) return '';
    return ' — ' + seg + ' was only seeked: ' + nextSeg + ' first came from ' + came +
      ' (write-once, a fresh landing FROM ' + seg + ' in a later chain still counts it)';
  }

  // a jump is only "mid-route" (red, impressions skipped) when an EARLIER step of the same
  // chain is still pending. if every step before it already landed, stepping to this row is
  // STARTING the next step, not hopping into the middle of a route — warning there reads as
  // "you are not allowed to start chains" and stops the user cold.
  function stepsBeforeDone(li, i) {
    const prev = i <= 0 || !li.parentElement ? [] : Array.prototype.slice.call(li.parentElement.children, 0, i);
    return prev.every((x) => x.classList.contains('rc-step-done'));
  }

  function fmt(v) {
    const s = Math.round(v / 1000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
    return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(s % 60).padStart(2, '0');
  }
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // where to stand in a segment you jump into cold: +3s, but never on/past an impression
  // moment (momentStart drops impressionData when you seeked into it)
  function seekSafe(seg) {
    const S = window.segmentMap && segmentMap.segments && segmentMap.segments[seg];
    if (!S) return null;
    let t = S.startTimeMs + 3000;
    for (const m of (window.momentsBySegment && window.momentsBySegment[seg]) || []) {
      if (m.startMs <= S.startTimeMs || !m.impressionData) continue;
      if (m.startMs - 500 < t) t = m.startMs - 500;
    }
    if (S.endTimeMs) t = Math.min(t, S.endTimeMs - 1000);
    return t;
  }

  // tiny evaluator for the shipped precondition trees, mirroring scripts.js
  // preconditionToJS: and / or / not / persistentState / eql, with eql as a loose == on the
  // parsed flag value (so p_ps == 't' compares 't', not '"t"' and not true).
  let unknownOpWarned = false;
  function val(expr, flags) {
    if (expr === null || expr === undefined) return null;
    if (typeof expr !== 'object') return expr;
    const op = expr[0];
    if (op === 'persistentState') return flags[expr[1]];
    if (op === 'not') return !val(expr[1], flags);
    if (op === 'and') return expr.slice(1).every((x) => val(x, flags));
    if (op === 'or') return expr.slice(1).some((x) => val(x, flags));
    if (op === 'eql') return val(expr[1], flags) == val(expr[2], flags);
    if (!unknownOpWarned) {
      unknownOpWarned = true;
      console.warn('[route-console] unknown precondition operator "' + op + '" — treating as false');
    }
    return false;
  }
  // a member shipped with no precondition passes for everyone (evalPrecondition: no cond -> true)
  const evalReq = (expr, flags) => (expr === null || expr === undefined ? true : !!val(expr, flags));

  // the flag names a condition needs, for "fix <names>" hints
  function describeCond(expr) {
    if (!Array.isArray(expr)) return '?';
    const op = expr[0];
    if (op === 'persistentState') return expr[1];
    if (op === 'eql') {
      const lhs = Array.isArray(expr[1]) ? describeCond(expr[1]) : String(expr[1]);
      return lhs + '=' + expr[2];
    }
    if (op === 'not') {
      const inner = expr[1];
      if (Array.isArray(inner)) return '!' + describeCond(inner);
      return '!(' + inner + ')';
    }
    if (op === 'or') return '(' + expr.slice(1).map(describeCond).join('|') + ')';
    if (op === 'and') return expr.slice(1).map(describeCond).join(' & ');
    return '?';
  }
  // flatten a failing 'and' so the panel can say WHICH flag is missing, not just "needs X"
  function failing(expr, flags, out) {
    if (!Array.isArray(expr)) return;
    if (expr[0] === 'and') {
      expr.slice(1).forEach((x) => failing(x, flags, out));
      return;
    }
    if (!evalReq(expr, flags)) {
      // not(and(X, Y)) fails while the AND holds: breaking ANY single leg flips it back,
      // so push one chip per leg — a compound "!p_pr & p_s3af" never matches fixChip's
      // one-flag regex and used to render as dead text
      if (expr[0] === 'not' && Array.isArray(expr[1]) && expr[1][0] === 'and') {
        expr[1].slice(1).forEach((leg) => {
          const d = describeCond(leg);
          if (out.indexOf(d) < 0) out.push(d);
        });
        return;
      }
      const d = describeCond(expr);
      if (out.indexOf(d) < 0) out.push(d);
    }
  }

  // the mirror image: which conditions does an EARLIER winning member rely on? breaking any
  // single one of these AND-items stops it matching, so a later target can win the group
  function beatItems(expr, out) {
    if (!Array.isArray(expr)) return;
    if (expr[0] === 'and') {
      expr.slice(1).forEach((x) => beatItems(x, out));
      return;
    }
    const d = describeCond(expr);
    if (out.indexOf(d) < 0) out.push(d);
  }

  // "fix p_x" / "fix p_ps=t" -> a button that jumps to the generated stop for that flag;
  // no stop exists for that value -> a marked span, never a dead button
  function fixChip(d, fl) {
    const m = /^(!?)([A-Za-z0-9_]+)(?:=(.+))?$/.exec(d);
    if (!m) return esc(d);
    const flag = m[2];
    const want = m[3] !== undefined ? m[3] : String(!fl[flag]);
    const stop = DATA.stops && DATA.stops[flag] && DATA.stops[flag][want];
    if (!stop) {
      return '<span class="rc-nostop" title="no known way to set ' + esc(flag) + '=' + esc(want) + '">' + esc(d) + '</span>';
    }
    return '<button class="rc-fix" data-flag="' + esc(flag) + '" data-want="' + esc(want) + '" title="jump there and set ' +
      esc(flag) + '=' + esc(want) + '">' + esc(d) + ' &#8599;</button>';
  }

  function flagsFor(step) {
    const names = new Set();
    const collect = (x) => {
      if (!Array.isArray(x)) return;
      if (x[0] === 'persistentState') names.add(x[1]);
      x.forEach(collect);
    };
    (step.group || []).forEach((m) => collect(m.req));
    const out = {};
    names.forEach((n) => {
      const v = localStorage.getItem('persistentState_' + n);
      try { out[n] = JSON.parse(v); } catch (e) { out[n] = v; }
    });
    return out;
  }

  // live flag values for every persistentState key a ranked stop list's guards touch
  function flagsForStops(list) {
    const names = new Set();
    const collect = (x) => {
      if (!Array.isArray(x)) return;
      if (x[0] === 'persistentState') names.add(x[1]);
      x.forEach(collect);
    };
    list.forEach((s) => (s.guard || []).forEach((m) => collect(m.req)));
    const out = {};
    names.forEach((n) => {
      const v = localStorage.getItem('persistentState_' + n);
      try { out[n] = JSON.parse(v); } catch (e) { out[n] = v; }
    });
    return out;
  }

  // does this stop actually deliver its promise under the live flags? a guarded stop lands
  // on the FIRST group member the flags allow — the trip only works when that member is one
  // of the flag-writing destinations this stop merged (targets). no guard = unconditional.
  function stopFit(s, fl) {
    if (!s.guard) return { ok: true };
    const landed = s.guard.find((m) => evalReq(m.req, fl));
    if (!landed) {
      return { ok: false, why: 'no group member matches your flags' + (s.fallback ? ' &rarr; goes to ' + esc(s.fallback) : ''), miss: targetMisses(s, fl) };
    }
    if ((s.targets || []).indexOf(landed.seg) >= 0) return { ok: true, landed };
    // diverted: the target may well pass too — say how to make the WINNER stop matching
    const beat = [];
    beatItems(landed.req, beat);
    let why = 'your flags send it to <b>' + esc(landed.seg) + '</b>';
    if (beat.length) why += ' &middot; make <b>' + esc(landed.seg) + '</b> lose: ' + beat.map((d) => fixChip(d, fl)).join(' or ');
    else why += ' &middot; ' + esc(landed.seg) + ' matches unconditionally — no flag can beat it here';
    return { ok: false, why, miss: targetMisses(s, fl) };
  }
  // what still blocks the flag-writing members (fix chips shown next to a reject reason)
  function targetMisses(s, fl) {
    const out = [];
    for (const t of s.targets || []) {
      const m = s.guard.find((x) => x.seg === t);
      if (m) failing(m.req, fl, out);
    }
    return out;
  }

  function stepLabel(st) {
    if (st.k === 'seek') return 'jump to <em>' + st.seg + '</em>';
    if (st.k === 'click') {
      const when = st.choiceAt !== null && st.choiceAt !== undefined ? ' <i>buttons ' + fmt(st.choiceAt) + '</i>' : '';
      return 'click <em>&quot;' + st.label + '&quot;</em> ' + when + ' &rarr; ' + st.into;
    }
    return 'watch <em>' + st.seg + '</em> &rarr; ' + st.into;
  }

  function build() {
    if (!DATA) {
      list.innerHTML = '<div style="color:#ff6b6b;padding:14px">route-data.js missing or failed to load — regenerate it with <b>node tools/mkchains.js &lt;plan.json&gt;</b></div>';
      stats.innerHTML = '<span style="color:#ff6b6b">no route data</span>';
      return;
    }
    const render = (items, kind) => items.map((it) => {
      const covers = kind === 'chain' ? it.covers : [it.into];
      return '<details class="rc-item" data-kind="' + kind + '" data-n="' + it.n + '">' +
        '<summary><span class="rc-mark" data-chain="' + kind + '-' + it.n + '">&#10003;</span>' +
        '<span class="rc-name">' + kind + ' ' + it.n + '</span>' +
        '<span class="rc-meta" data-meta="' + kind + '-' + it.n + '"></span></summary>' +
        '<div class="rc-covers">covers: <span>' + covers.join(', ') + '</span></div>' +
        '<ol class="rc-steps">' + it.steps.map((st, si) =>
          '<li class="rc-step" data-kind="' + kind + '" data-n="' + it.n + '" data-i="' + si + '">' +
          '<span class="rc-mark">&#10003;</span>' +
          '<span class="rc-t">' + fmt(st.at) + '</span>' +
          '<span class="rc-b">' + stepLabel(st) + '</span>' +
          '<span class="rc-why" data-why="' + kind + '-' + it.n + '-' + si + '"></span></li>').join('') +
        '</ol></details>';
    }).join('');

    list.innerHTML =
      '<div class="rc-title" style="padding:2px 4px 6px">setups — run 1&rarr;7, 7 last</div>' + render(DATA.setups, 'setup') +
      '<div class="rc-title" style="padding:10px 4px 6px">chains</div>' + render(DATA.chains, 'chain');

    list.querySelectorAll('li.rc-step').forEach((li) => li.addEventListener('click', () => {
      const kind = li.dataset.kind, n = +li.dataset.n, i = +li.dataset.i;
      const item = (kind === 'chain' ? DATA.chains : DATA.setups).find((x) => x.n === n);
      jump(item.steps[i], null, !stepsBeforeDone(li, i));
    }));
    refresh();
  }

  function jump(st, note, mid) {
    const v = document.getElementById('video');
    if (!v || !v.currentSrc) {
      toast('no video loaded — pick the video file first', true);
      return;
    }
    seek(st.at);
    const msg = (note ? note + ' — ' : '') + 'jumped to ' + st.seg + ' at ' + fmt(st.at) +
      (mid
        ? ' · MID-ROUTE jump: impressions before this point were skipped, state flags may resolve somewhere else'
        : ' · a jump writes no progress, watch from here');
    toast(msg, !!mid);
  }

  // one line describing a generated stop (route-data.js stops[flag][value]), in watch order.
  // noGrp: drop the "first member wins" italic — reject lines below already say where you'd land
  function stopLine(s, noGrp) {
    const startOf = (x) => (window.segmentMap && segmentMap.segments[x] ? segmentMap.segments[x].startTimeMs : null);
    let l = 'jump <b>' + esc(s.seg) + '</b> at ' + fmt(s.at);
    if (s.click) {
      // show the REAL click window, and name what the moment's default fires if you miss it —
      // a jump lands you mid-window, and an unclicked default auto-fires at the segment end
      // (SS21's PAC window is 4:35:25-4:35:54 and the default is [KILL DAD] -> 5H)
      const segMoments = (window.momentsBySegment || {})[s.seg] || [];
      const mom = segMoments.find((x) => x.startMs === s.clickAt && (x.choices || []).some((cc) => cc.text === s.click));
      const dci = mom && mom.choices[mom.defaultChoiceIndex];
      const diverts = !!(dci && dci.segmentId && s.dest && dci.segmentId !== s.dest);
      l += ' &middot; click <b>&quot;' + esc(s.click) + '&quot;</b> ' +
        (mom ? fmt(s.clickAt) + '&ndash;' + fmt(mom.endMs) : 'at ' + fmt(s.clickAt)) +
        (diverts ? ' <span class="rc-warn">miss it and <b>[' + esc(dci.text) + ']</b> fires &rarr; ' + esc(dci.segmentId) + '</span>' : '');
    }
    if (s.hopEnd) l += ' &middot; watch to ' + fmt(s.hopEnd);
    if (s.dest) {
      // a merged trip serves every flag-writing landing: show them all, not just the first
      const dests = s.targets && s.targets.length > 1 ? s.targets.join('/') : s.dest;
      l += ' &rarr; ' + esc(dests) + (s.grp && !noGrp ? ' <i>&larr; segment group: the first member your flags allow wins, not necessarily this one</i>' : '');
    }
    if (s.watch != null) {
      const base = startOf(s.dest || s.seg);
      const near = base != null && s.watch - base <= 1500;
      l += near ? ' &middot; let it play a beat, the flag fires right there' : ' &middot; watch to ' + fmt(s.watch) + ' (flag fires)';
    }
    if (!s.nuclear && s.side && s.side.length) {
      l += ' &middot; also sets ' + s.side.slice(0, 6).map(esc).join(' ') + (s.side.length > 6 ? ' +' + (s.side.length - 6) : '');
    }
    return l;
  }

  // a "fix p_x" chip: a ranked candidate list ships for each (flag, value) — pick the first
  // NON-nuclear route whose guard the LIVE flags satisfy and jump there. when none fit, say
  // so loudly: every candidate with the exact reason it rejects + the chips that would
  // change the verdict, and offer the 1A reset as an explicit destructive choice (never
  // auto-jump it — it wipes the whole save). only flags whose sole writer IS the reset
  // (force or otherwise) take the nuclear path directly.
  function applyFix(flag, want, force) {
    const list = DATA.stops && DATA.stops[flag] && DATA.stops[flag][String(want)];
    if (!Array.isArray(list) || !list.length) {
      toast('no stop generated for ' + flag + '=' + want, true);
      return;
    }
    const doEl = root.querySelector('#rc-do');
    const fl = flagsForStops(list);
    const fits = list.map((s) => stopFit(s, fl));
    let pick = fits.findIndex((f, k) => f.ok && !list[k].nuclear);
    const nuclearIdx = list.findIndex((s) => s.nuclear);
    if (pick < 0) {
      const onlyNuclear = nuclearIdx >= 0 && list.every((s) => s.nuclear);
      if (!force && !onlyNuclear) {
        // lead with the ONE fix that unblocks the most routes — the reject list below is the
        // detail, the first line is the next click
        const missCount = new Map();
        list.forEach((s, k) => {
          if (s.nuclear) return;
          (fits[k].miss || []).forEach((d) => missCount.set(d, (missCount.get(d) || 0) + 1));
        });
        let top = null, topN = 0;
        missCount.forEach((n, d) => {
          if (n <= topN) return;
          if (fixChip(d, fl).indexOf('<button') < 0) return; // only a clickable fix may be the headline
          top = d;
          topN = n;
        });
        const normalCount = list.filter((s) => !s.nuclear).length;
        const summary = top
          ? '<div class="rc-first">first: ' + fixChip(top, fl) + ' <span>&mdash; ' + topN + ' of ' + normalCount +
            ' routes need it; after watching that stop, click <b>fix ' + esc(flag) + '</b> again</span></div>'
          : '';
        doEl.classList.remove('rc-nuclear');
        doEl.classList.add('rc-nofit');
        doEl.innerHTML = '<b>' + esc(flag) + ' &rarr; ' + esc(want) + ' &mdash; NO stop fits your flags:</b>' + summary +
          list.map((s, k) => {
            if (s.nuclear) {
              return '<div class="rc-reject">' + stopLine(s, true) + ' &middot; always works, but <b>wipes EVERY state flag</b>' +
                ' &middot; <button class="rc-fix" data-flag="' + esc(flag) + '" data-want="' + esc(want) +
                '" data-force="1" title="the 1A reset clears every flag in the save">do it anyway &#8599;</button></div>';
            }
            return '<div class="rc-reject">' + stopLine(s, true) + ' &middot; ' + (fits[k].why || '') +
              (fits[k].miss && fits[k].miss.length ? ' &middot; fix ' + fits[k].miss.slice(0, 3).map((d) => fixChip(d, fl)).join(' ') : '') +
              '</div>';
          }).join('');
        doEl.classList.add('rc-on');
        toast('no ' + flag + '=' + want + ' stop fits your flags — see the banner', true);
        return;
      }
      pick = nuclearIdx;
    }
    if (pick < 0) {
      toast('no usable stop for ' + flag + '=' + want, true);
      return;
    }
    doEl.classList.remove('rc-nofit');
    const stop = list[pick];
    doEl.classList.toggle('rc-nuclear', !!stop.nuclear);
    doEl.innerHTML =
      (stop.nuclear ? '<b class="rc-warn">INTRO RESET &mdash; wipes EVERY state flag (anything you set earlier dies)</b><br>' : '') +
      '<b>' + esc(flag) + ' &rarr; ' + esc(want) + '</b> &middot; ' + stopLine(stop);
    doEl.classList.add('rc-on');
    jump({ seg: stop.seg, at: stop.at }, flag + ' ' + want, false);
    if (stop.nuclear) toast('NUCLEAR stop: ' + flag + ' only clears via the 1A reset, which clears everything else too', true);
  }

  function gotoSeg(seg) {
    const t = seekSafe(seg);
    if (t == null) {
      toast('no known seek time for ' + seg, true);
      return;
    }
    jump({ seg, at: t }, 'other landing', false);
  }

  function refresh() {
    if (!DATA) return;
    try {
      const covered = coveredSet();
      let chainDoneCount = 0, setupDoneCount = 0, chainTotal = DATA.chains.length, setupTotal = DATA.setups.length;

      // ticks one row-set; returns the targets that are still missing from the save.
      // a seek step is special: seeking writes nothing, so its segment only ever shows up as
      // the *value* of the next segment's breadcrumb (and breadcrumbs are write-once, so an
      // older route can leave that value stale forever). treat it as started as soon as the
      // step after it landed.
      const applySteps = (kind, it) => {
        const missing = [];
        const flags = it.steps.map((st) => {
          const t = st.k === 'seek' ? st.seg : st.into;
          return !!t && covered.has(t);
        });
        for (let i = it.steps.length - 2; i >= 0; i--) {
          if (it.steps[i].k === 'seek' && !flags[i] && flags[i + 1]) flags[i] = true;
        }
        it.steps.forEach((st, i) => {
          const target = st.k === 'seek' ? st.seg : st.into;
          const sdone = flags[i];
          const li = list.querySelector('li.rc-step[data-kind="' + kind + '"][data-n="' + it.n + '"][data-i="' + i + '"]');
          if (li) li.classList.toggle('rc-step-done', sdone);
          const why = list.querySelector('[data-why="' + kind + '-' + it.n + '-' + i + '"]');
          if (why) {
            if (sdone) why.textContent = '';
            else if (st.group && st.group.length) {
              // the destination resolves through a segment group: the player takes the FIRST
              // member that matches, so a target that matches can still lose to an earlier one
              const fl = flagsFor(st);
              const landed = st.group.find((m) => evalReq(m.req, fl));
              const tgt = st.group.find((m) => m.seg === target);
              const tgtOk = !!(tgt && evalReq(tgt.req, fl));
              let msg = 'needs ' + esc(target);
              if (landed && landed.seg !== target) {
                msg += ' · your flags send it to <button class="rc-goto" data-seg="' + esc(landed.seg) +
                  '" title="jump to ' + esc(landed.seg) + '">' + esc(landed.seg) + '</button>';
                if (tgtOk) {
                  // the target passes too — the only problem is the winner: name what beats it
                  const beat = [];
                  beatItems(landed.req, beat);
                  msg += ' (' + esc(target) + ' matches too, but an earlier member wins)';
                  if (beat.length) msg += ' · make ' + esc(landed.seg) + ' lose: ' + beat.slice(0, 3).map((d) => fixChip(d, fl)).join(' or ');
                } else {
                  // diverted AND the target itself does not pass yet: say what the target needs
                  const miss = [];
                  if (tgt) failing(tgt.req, fl, miss);
                  if (miss.length) msg += ' · fix ' + miss.slice(0, 4).map((d) => fixChip(d, fl)).join(' ');
                }
              } else if (landed) {
                msg += st.k === 'click' ? ' · flags ok, click lands here' : ' · flags ok, plays here';
              } else {
                const miss = [];
                if (tgt) failing(tgt.req, fl, miss);
                if (miss.length) msg += ' · fix ' + miss.slice(0, 4).map((d) => fixChip(d, fl)).join(' ');
                else msg += st.fallback ? ' · no member matches, goes to ' + esc(st.fallback) : ' · no member matches your flags';
              }
              // live flag values: "why" is decided by these, so they are on the row itself
              const live = Object.keys(fl).sort().slice(0, 20).map((k) => {
                const v = fl[k];
                return k.replace(/^p_/, '') + '=' + (v === true ? 1 : v === false || v === null || v === undefined ? 0 : v);
              }).join(' ');
              if (live) msg += ' · ' + esc(live);
              why.innerHTML = msg;
            } else {
              const got = (st.siblings || []).filter((x) => x !== target && covered.has(x));
              const have = got.length ? got.slice(0, 3).join('/') + (got.length > 3 ? ' +' + (got.length - 3) : '') : '';
              why.textContent = 'needs ' + target + (have ? ' (also have ' + have + ')' : '');
            }
          }
          if (!sdone && target && missing.indexOf(target) < 0) missing.push(target);
          const skey = kind + '-' + it.n + '-' + i;
          sdone ? prevStepDone.add(skey) : prevStepDone.delete(skey);
        });
        return missing;
      };

      DATA.chains.forEach((c) => {
        const hits = c.covers.filter((x) => covered.has(x)).length;
        const done = hits === c.covers.length;
        if (done) chainDoneCount++;
        const key = 'chain-' + c.n;
        const mark = list.querySelector('.rc-mark[data-chain="' + key + '"]');
        const meta = list.querySelector('[data-meta="' + key + '"]');
        const box = list.querySelector('details[data-kind="chain"][data-n="' + c.n + '"]');
        applySteps('chain', c);
        if (mark) mark.classList.toggle('rc-hit', done);
        if (meta) {
          meta.textContent = hits + '/' + c.covers.length;
          if (done) {
            meta.title = 'every segment this chain covers is in the save';
          } else {
            const unc = c.covers.filter((x) => !covered.has(x));
            let title = 'still missing from the save: ' + unc.join(', ');
            for (const x of unc) {
              const si = c.steps.findIndex((st, i) => st.k === 'seek' && st.seg === x && i + 1 < c.steps.length);
              if (si >= 0) title += staleSeekWhy(x, c.steps[si + 1].into, covered);
            }
            meta.title = title;
          }
        }
        if (box) box.classList.toggle('rc-done', done);
        if (done && !prevChainDone.has(key) && prevChainDone.size) toast('chain ' + c.n + ' complete \u2713');
        done ? prevChainDone.add(key) : prevChainDone.delete(key);
      });

      DATA.setups.forEach((s) => {
        const missing = applySteps('setup', s);
        const all = missing.length === 0;
        if (all) setupDoneCount++;
        const key = 'setup-' + s.n;
        const mark = list.querySelector('.rc-mark[data-chain="' + key + '"]');
        const meta = list.querySelector('[data-meta="' + key + '"]');
        const box = list.querySelector('details[data-kind="setup"][data-n="' + s.n + '"]');
        if (mark) mark.classList.toggle('rc-hit', all);
        if (meta) meta.innerHTML = all ? 'done' : '<span class="rc-need">needs ' + missing.join(', ') + '</span>';
        if (box) box.classList.toggle('rc-done', all);
      });

      const segTotal = (window.segmentMap && Object.keys(segmentMap.segments).length) || 250;
      const now = new Date();
      stats.innerHTML =
        '<div>segments <b>' + covered.size + '</b>/' + segTotal +
        ' &middot; chains <b class="' + (chainDoneCount === chainTotal ? 'rc-ok' : '') + '">' + chainDoneCount + '/' + chainTotal + '</b>' +
        ' &middot; setups <b class="' + (setupDoneCount === setupTotal ? 'rc-ok' : '') + '">' + setupDoneCount + '/' + setupTotal + '</b></div>' +
        '<div class="rc-live">live &middot; read the save at ' +
        String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0') + ':' + String(now.getSeconds()).padStart(2, '0') +
        ' &middot; covered segments: ' + covered.size + '</div>';
      bar.style.width = Math.round((chainDoneCount / Math.max(1, chainTotal)) * 100) + '%';

      if (filter !== 'all') {
        list.querySelectorAll('details.rc-item').forEach((d) => {
          const done = d.classList.contains('rc-done');
          d.style.display = (filter === 'done') === done ? '' : 'none';
        });
      }
    } catch (err) {
      console.error('[route-console] refresh failed', err);
      if (lastErr !== String(err)) {
        lastErr = String(err);
        toast('route console refresh failed: ' + err.message, true);
      }
    }
  }

  function nextPending() {
    const groups = [...DATA.setups.map((s) => ({ kind: 'setup', it: s })), ...DATA.chains.map((c) => ({ kind: 'chain', it: c }))];
    for (const g of groups) {
      const li = [...list.querySelectorAll('li.rc-step[data-kind="' + g.kind + '"][data-n="' + g.it.n + '"]')]
        .find((x) => !x.classList.contains('rc-step-done'));
      if (li) {
        const det = li.closest('details');
        det.open = true;
        li.scrollIntoView({ block: 'center', behavior: 'smooth' });
        const st = g.it.steps[+li.dataset.i];
        jump(st, 'next pending: ' + g.kind + ' ' + g.it.n + ' step ' + (+li.dataset.i + 1), !stepsBeforeDone(li, +li.dataset.i));
        return;
      }
    }
    toast('every routed step is checked off \u2713');
  }

  function toggle() { root.classList.toggle('rc-hidden'); }

  root.querySelector('#rc-fab').addEventListener('click', toggle);
  root.querySelector('#rc-close').addEventListener('click', toggle);
  root.querySelector('#rc-next').addEventListener('click', nextPending);
  root.querySelectorAll('#rc-actions button[data-filter]').forEach((b) => b.addEventListener('click', () => {
    filter = b.dataset.filter;
    root.querySelectorAll('#rc-actions button[data-filter]').forEach((x) => x.classList.toggle('rc-on', x === b));
    refresh();
  }));
  // capture phase: the fix/goto chips sit inside clickable step rows AND inside the
  // dismissable banner — stopPropagation must run first, or the row jump / banner dismiss
  // would fire instead of the chip
  function chipClick(e) {
    if (!(e.target instanceof Element)) return;
    const fix = e.target.closest('.rc-fix');
    if (fix) {
      e.stopPropagation();
      applyFix(fix.dataset.flag, fix.dataset.want, fix.dataset.force === '1');
      return;
    }
    const go = e.target.closest('.rc-goto');
    if (go) {
      e.stopPropagation();
      gotoSeg(go.dataset.seg);
    }
  }
  list.addEventListener('click', chipClick, true);
  root.querySelector('#rc-do').addEventListener('click', chipClick, true);
  root.querySelector('#rc-do').addEventListener('click', function () { this.classList.remove('rc-on', 'rc-nofit'); });
  document.addEventListener('keydown', (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    const tag = (e.target && e.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (e.key === 'c' || e.key === 'C') { toggle(); e.preventDefault(); }
    if (e.key === 'n' || e.key === 'N') { nextPending(); e.preventDefault(); }
  });

  build();
  setInterval(refresh, 1000);
  window.__routeConsole = { toggle, refresh, jump, toast, applyFix, gotoSeg };
  console.log('route console ' + RC_VERSION + ' ready — press C to toggle, N for the next pending step');
})();
