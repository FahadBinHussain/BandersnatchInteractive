// route console — in-page list of every chain + setup from route-data.js
// toggle with C, jump to the next pending step with N
// steps are clickable: they seek the player (a seek writes no progress, it just moves you)
(function () {
  'use strict';

  const RC_VERSION = '2026-10-05.4';
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

  function fmt(v) {
    const s = Math.round(v / 1000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
    return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(s % 60).padStart(2, '0');
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
      const d = describeCond(expr);
      if (out.indexOf(d) < 0) out.push(d);
    }
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
      jump(item.steps[i], null, i > 0);
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
              let msg = 'needs ' + target;
              if (landed && landed.seg !== target) {
                msg += ' · your flags send it to ' + landed.seg;
                if (tgtOk) msg += ' (' + target + ' matches too, but an earlier member wins)';
              } else if (landed) {
                msg += st.k === 'click' ? ' · flags ok, click lands here' : ' · flags ok, plays here';
              } else {
                const miss = [];
                if (tgt) failing(tgt.req, fl, miss);
                if (miss.length) msg += ' · fix ' + miss.slice(0, 4).join(' ');
                else msg += st.fallback ? ' · no member matches, goes to ' + st.fallback : ' · no member matches your flags';
              }
              // live flag values: "why" is decided by these, so they are on the row itself
              const live = Object.keys(fl).sort().slice(0, 20).map((k) => {
                const v = fl[k];
                return k.replace(/^p_/, '') + '=' + (v === true ? 1 : v === false || v === null || v === undefined ? 0 : v);
              }).join(' ');
              if (live) msg += ' · ' + live;
              why.textContent = msg;
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
        const missing = applySteps('chain', c);
        if (mark) mark.classList.toggle('rc-hit', done);
        if (meta) {
          meta.textContent = hits + '/' + c.covers.length;
          meta.title = done ? 'every segment this chain covers is in the save' : 'still missing from the save: ' + missing.join(', ');
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
        jump(st, 'next pending: ' + g.kind + ' ' + g.it.n + ' step ' + (+li.dataset.i + 1), +li.dataset.i > 0);
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
  document.addEventListener('keydown', (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    const tag = (e.target && e.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (e.key === 'c' || e.key === 'C') { toggle(); e.preventDefault(); }
    if (e.key === 'n' || e.key === 'N') { nextPending(); e.preventDefault(); }
  });

  build();
  setInterval(refresh, 1000);
  window.__routeConsole = { toggle, refresh, jump, toast };
  console.log('route console ' + RC_VERSION + ' ready — press C to toggle, N for the next pending step');
})();
