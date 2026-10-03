# AGENTS.md — BandersnatchInteractive

local, offline Bandersnatch player. one mp4 in the repo root (gitignored), an interactive
overlay, and a progress save that lives in the browser. the whole point of the work here is
getting the save to 100% segment coverage.

## run it

```
python -m http.server 8000 --bind 127.0.0.1     # docroot = this repo
```

open `http://127.0.0.1:8000`. **never open it via `bandersnatch.bat` / `file://`** — that origin
has a separate, virgin localStorage and any progress you make there is invisible to the real save.

long-running servers must be launched detached (`Start-Process pwsh -ArgumentList '-Command',...`),
otherwise the bash tool hangs on the inherited stdout pipe.

## the save

- origin `http://127.0.0.1:8000`, keys in localStorage:
  - `breadcrumb_<SEGMENT>` — written by `playNextSegment` (`assets/scripts.js`, ~line 496) **only
    when playback naturally passes through that segment**. this is the coverage counter.
  - `choice_*` / `persistentState_*` — the 62 state flags.
  - `place` — current segment, set by hash/seek jumps too.
- **seeking, hash jumps and the seek bar write no breadcrumb.** a segment counts only if you
  actually watch through it. don't "verify" coverage by checking `place`.
- dump the live save (needed by the planner): devtools → console →
  `copy(JSON.stringify({...Object.fromEntries(Object.entries(localStorage))}))`, paste to a json file.
  keep dumps in `C:\tmp` (scratch), never commit them.

## vocabulary

| term | meaning |
|---|---|
| segment | one chunk of film (`5AF` = 1:05:03 → 1:06:22). 250 total. times come from `assets/SegmentMap.js` (`startTimeMs` / `endTimeMs`). |
| choice point | one of the 174 clickable moments. |
| state flag | one of 62 invisible booleans/enums in localStorage; gates which segments/groups you may enter. |
| chain | a route: `SEEK x` (hash jump) → watch → click what the line says. one chain = the new segments it lists. 72 chains cover 146 new segments. |
| setup | same shape, but its job is flipping state flags. 7 of them; later chains land in the wrong place without them. |

## the route

`ROUTE.md` is the answer file: 72 chains + 7 setups, arrow format, timestamps are absolute
video time. regenerate with:

```
node tools/route-planner.js <dump.json> > C:\tmp\plan.json
node tools/mkchains.js C:\tmp\plan.json     # writes ROUTE.md + tools/chains.txt
```

rules the route follows:

1. each chain starts with `SEEK` because the seek itself writes nothing; after that it's pure
   playback — no more seeking until the next chain.
2. **setups run 1 → 7, setup 7 last.** setups 1, 2 and 7 start at `1A` / 0:00, and the intro's
   reset moment wipes state flags — so the last setup run decides the flag state everything
   after it expects. running them out of order silently breaks later chains.
3. chains 22/27/38/40/41/44/47/50/52/55/58 also begin `SEEK 1A → 0:00` on purpose: the reset
   is what makes their flag combination enterable.
4. the video clock jumps between segments (8L ends 55:28 → next hop starts 4:33:45 → the one
   after that is back at 36:01). that's normal, those are segment-group hops.
5. a step's timestamp is the **segment start**, not the moment the buttons appear — the choice
   window is usually near the segment's end (often 1–90s later) and is printed as
   `[choice at H:MM:SS]`. never "fix" this by seeking straight to the choice: `momentStart`
   drops that moment's state impression when you seek into it, so you'd land in the segment
   with the wrong flags. seek to the segment start and watch in.

## ceiling: 249 / 250

`Z61d` is unreachable. it is only entered by `SS54 → choice WhoThere-SS54`, which requires
`p_bup && p_s3af && p_cd && p_vs==='k' && !p_pr && !p_2b`. `p_pr` and `p_2b` are only cleared
by the `1A` intro reset, which also clears `p_s3af`, and `p_s3af` can only be set again from
`PACStudyChoice` / `R6` — a blocked search from `1A` (blacklisting `2B*`, `6A`) reaches none of
them. so 249 is the real max, and it's fine: `Z61d` must stay out of any "why is it not 250"
panic.

## progress overlay

paste `progress-tracker.js` into devtools console (F12), toggle with backtick. trust the
**segments** and **choice-points** rows. the **states** row is broken (it counts every key
including absent ones, so it always reads 100%) — don't report it as real.

## planner notes (`tools/route-planner.js`)

simulation from the dumped save: A* per fresh segment + a state-repair search when a segment
isn't enterable. things that were fixed once and must stay fixed:

- `outsFor` must include the selfgroup branch (`resolveSegmentGroup(prevSegment)`), not just
  `nextChoice` / `defaultNext`.
- transitions resolve the segment group **before** applying the choice's impression
  (`playNextSegment` order: nextChoice → selfgroup → defaultNext).
- impressions apply only when the segment was *played into*, never when seeked to
  (`momentStart(m, seeked)`).
- brute force over flag combinations must handle enum flags (`p_ps`, `p_vs`, `p_pc`), not only booleans.
- `canEnter` must be driven by the *dynamic* predecessor (`defSrc` / `chSrc` / `grpSrc`), not the
  static `incoming` list — the static list contains unconditional `default` edges and lets you
  "enter" segments you actually can't.
- keep state dedup to a parent-pointer BFS with a cap, or the full-state set OOMs.
- `MAXEXP` env var caps expansions when a run gets too slow.

## shipping

commit + push after a task is done (rule: always push, then say you pushed). route/doc changes
go straight to the current branch. no personal secrets, no save dumps, no account tokens in the repo.
