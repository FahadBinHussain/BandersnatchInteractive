// paste this in the browser console (F12) while on the player page
// live version — updates an overlay panel every `INTERVAL` ms
// toggle the panel with the ` (backtick) key, or call stopProgressTracker()

(function () {
  if (window.__bandersnatchProgress) {
    window.__bandersnatchProgress.stop();
  }

  const INTERVAL = 1000; // refresh rate in ms

  function analyze() {
    let allSegments = Object.keys(segmentMap.segments);
    let totalSegments = allSegments.length;

    let visitedSegments = new Set();
    for (let i = 0; i < localStorage.length; i++) {
      let k = localStorage.key(i);
      if (k.startsWith('breadcrumb_')) {
        visitedSegments.add(k.replace('breadcrumb_', ''));
        let src = localStorage.getItem(k);
        if (src) visitedSegments.add(src);
      }
    }

    // only moments Netflix registered in choicePoints can EVER count — the other 28
    // shipped choice-moments (EXIT TO CREDITS split-screens, GO BACK, the 2B "NO"s)
    // have no registered id, so counting them in the denominator made 174/174
    // impossible by construction (the row sat at 83% forever after a complete route)
    let totalChoices = 0;
    let reachedChoices = 0;
    let uncountable = 0;
    let unreachableChoices = 0;
    // documented ceiling (AGENTS.md "ceiling: 249 / 250"): Z61d's natural entry is a flag
    // deadlock, so while it is unvisited it stays out of the denominator (145/145 = 100%);
    // the AGENTS Z61d seek trip can still record it, and then the count stands alone (146/146)
    const unreachableSegs = ['Z61d'];

    for (let segId in momentsBySegment) {
      let moments = momentsBySegment[segId] || [];
      for (let i = 0; i < moments.length; i++) {
        let m = moments[i];
        if (m.choices && m.choices.length > 0) {
          if (m.id && choicePoints[m.id]) {
            totalChoices++;
            if (visitedSegments.has(segId)) reachedChoices++;
            else if (unreachableSegs.indexOf(segId) >= 0) unreachableChoices++;
          } else {
            uncountable++;
          }
        }
      }
    }

    let totalStates = Object.keys(bv.stateHistory).length;
    let setStates = 0;
    for (let k in bv.stateHistory) {
      let val = localStorage.getItem('persistentState_' + k);
      if (val !== null) setStates++;
    }

    return {
      totalSegments,
      visited: visitedSegments.size,
      segPct: totalSegments ? Math.round((visitedSegments.size / totalSegments) * 100) : 0,
      totalChoices,
      reachedChoices,
      uncountable,
      choicePct: Math.round((reachedChoices / Math.max(1, totalChoices - unreachableChoices)) * 100),
      totalStates,
      setStates,
      statePct: totalStates ? Math.round((setStates / totalStates) * 100) : 0,
    };
  }

  function bar(pct, width) {
    const filled = Math.round((pct / 100) * width);
    return '[' + '#'.repeat(filled) + '-'.repeat(Math.max(0, width - filled)) + '] ' + pct + '%';
  }

  // build overlay
  const panel = document.createElement('div');
  panel.id = '__bp_panel';
  panel.style.cssText = [
    'position:fixed',
    'top:10px',
    'right:10px',
    'z-index:2147483647',
    'background:rgba(0,0,0,0.85)',
    'color:#0f0',
    'font:12px/1.4 Consolas,monospace',
    'padding:10px 12px',
    'border:1px solid #0f0',
    'border-radius:6px',
    'white-space:pre',
    'pointer-events:none',
    'max-width:340px',
    'box-shadow:0 4px 20px rgba(0,0,0,0.5)',
  ].join(';');
  document.body.appendChild(panel);

  function render() {
    let p;
    try {
      p = analyze();
    } catch (e) {
      panel.textContent = 'progress tracker: ' + e.message;
      return;
    }
    panel.textContent =
      '=== BANDERSNATCH PROGRESS ===\n' +
      '\nSegments   ' + bar(p.segPct, 18) + '\n' +
      '  ' + p.visited + ' / ' + p.totalSegments + '\n' +
      '\nChoices    ' + bar(p.choicePct, 18) + '\n' +
      '  ' + p.reachedChoices + ' / ' + p.totalChoices + (p.uncountable ? '  (+' + p.uncountable + ' can never count)' : '') + '\n' +
      '\nStates     ' + bar(p.statePct, 18) + '\n' +
      '  ' + p.setStates + ' / ' + p.totalStates + '\n' +
      '\nrefresh: ' + INTERVAL + 'ms | ` to hide';
  }

  const timer = setInterval(render, INTERVAL);
  render();

  function onKey(e) {
    if (e.key === '`') {
      panel.style.display = panel.style.display === 'none' ? '' : 'none';
    }
  }
  document.addEventListener('keydown', onKey);

  window.__bandersnatchProgress = {
    stop() {
      clearInterval(timer);
      document.removeEventListener('keydown', onKey);
      panel.remove();
      delete window.__bandersnatchProgress;
      console.log('progress tracker stopped');
    },
    show() { panel.style.display = ''; },
    hide() { panel.style.display = 'none'; },
  };

  console.log('progress tracker running. press ` to toggle, stopProgressTracker() to stop');
})();

// convenience alias
function stopProgressTracker() {
  if (window.__bandersnatchProgress) window.__bandersnatchProgress.stop();
}
