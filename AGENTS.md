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
    **values are write-once**: `breadcrumb_R1` remembers the segment you first entered `R1`
    from, forever — if an unrelated watch beats the plan (chain 14 planned `SS2 → R1`, but
    `R1` first landed from `5QA`), the planned value-write for the seek target (`SS2`) can
    never happen on that trip. the target only counts when a later chain lands something
    still-fresh FROM it; the chain's hover meta spells out the exact culprit.
  - `choice_*` / `persistentState_*` — the 62 state flags.
  - `place` — current segment, set by hash/seek jumps too.
- **seeking, hash jumps and the seek bar write no breadcrumb.** a segment counts only if you
  actually watch through it. don't "verify" coverage by checking `place`.
- dump the live save (needed by the planner): devtools → console →
  `copy(JSON.stringify({...Object.fromEntries(Object.entries(localStorage))}))`, paste to a json file.
  keep dumps in `C:\tmp` (scratch), never commit them. **or skip devtools**: `node tools/save-dump.js
  <out.json>` decodes the save straight out of Edge's localStorage leveldb (fresh copy of the
  profile's `Local Storage\leveldb` — snappy blocks, restart-array trailer, chromium's
  `_origin\x00\x01<name>\x01<meta>` key framing) and writes the same flat json the planner reads.

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
node tools/mkchains.js C:\tmp\plan.json     # writes ROUTE.md + tools/chains.txt + route-data.js
```

rules the route follows:

1. each chain starts with `SEEK <seg> at <time>` because the seek itself writes nothing; the
   time is a few seconds **inside** the segment (a segment's first frame is also the previous
   segment's last frame — seeking exactly there can make the player treat you as the outgoing
   segment and fire *its* choice, sending you somewhere else entirely). after that it's pure
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

## route console + progress overlay (both in-page now)

`index.html` loads three scripts (no more devtools pasting):

- `route-data.js` — generated by `tools/mkchains.js` next to `ROUTE.md` / `tools/chains.txt`.
  never hand-edit it; if it's missing the console says so loudly instead of guessing.
- `route-console.js` — press **C** for the panel: every setup + chain, live checkmarks off
  `breadcrumb_*` (re-read from the save every 1s, timestamp in the stats row proves it). a row
  that is still pending shows the exact missing segment in red (`needs 3AL`) and the setup meta
  lists what the save lacks, so "why is this pending" is always on screen. a `SEEK` step counts
  as done once the step after it landed — seeking writes nothing, and breadcrumb values are
  write-once, so the seek target itself may never show up as a value. when that happens the chain
  shows `N/M` with every step ticked, and the hover title names the culprit (`SS2 was only seeked:
  R1 first came from 5QA (write-once, a fresh landing FROM SS2 in a later chain still counts it)`).
  a step that lands through a
  segment group (a group click, or any `let play` hop) carries that group's members + the shipped
  preconditions, evaluated live against `persistentState_*` with the same and/or/not/eql semantics
  as `preconditionToJS`: the row prints `flags ok, plays here`, `your flags send it to <other
  member>`, or `fix <flag>` naming exactly the flags blocking the target — that is how you tell
  "wrong flags" from "didn't watch it". the player takes the **first** matching member in group
  order, so a target can match and still lose (`… your flags send it to SS9 (SS22 matches too,
  but an earlier member wins)`) — never read "target passes" as "I will land there". the row
  ends with the live flag values it evaluated (`… · 2b=1 bo=1 ty=0 …`), so a screenshot is
  enough to diagnose a wrong landing. the footer shows
  the build stamp — if it isn't the newest, the browser is serving a cached copy (hard reload).
  **N** jumps to the next pending step. clicking any step seeks the player to that step's
  seek-safe time (segment start +3s, clamped before interior impression moments); a jump into
  the middle of a route warns in red **only when an earlier step of that chain is still pending**
  — that is when impressions are genuinely skipped. a prefix of done steps means you are starting
  the next step, not hopping (the old `i > 0` rule fired red on every chain whose step 0 was
  already ticked, and read as "i can't start chains").
  a seek writes no progress — coverage only comes from watching through a segment.
  the `fix <flag>` hints are **buttons**: clicking one fills the amber banner with the full stop
  (`jump 7H at 1:51:42 · click "KARATE CHOP DAD" 1:51:55–1:52:12 → 7K · also sets p_np`), dismiss on
  click, and seeks there. click times render as the **full window** (start–end, read live off the
  moment) and a red `miss it and [KILL DAD] fires → 5H` names the default that auto-fires when
  the window ends — the jump lands mid-window, so a slow read of the banner used to burn the
  window silently and dump you on the default landing (`SS21 → R6` looked broken this way); the
  `your flags send it to <member>` name is a button too (jumps to that
  member). stops ship in `route-data.js` under `stops` as a **ranked candidate array** per
  (flag, value) (62 flags / 215 stops, generated by `tools/mkchains.js`, max 6 non-nuclear trips
  + the 1A reset always kept): identity is the TRIP, not the landing — one "jump SS54, click
  WHO'S THERE" merges every group member that writes the flag into one stop with `targets` = those
  landings. a stop that lands through a group carries its ordered `guard` (same groupMembers
  expansion + first-match evaluation as the rows) plus `fallback` (what the player does when no
  member matches: fall through to `defaultNext`). `applyFix` picks the first **non-nuclear**
  candidate whose guard the live flags satisfy; when none fit it shows a red `NO stop fits your
  flags` banner **led by a `first: <fix> ↗ — N of M routes need it` headline** (the clickable fix
  shared by the most rejects — fix that first, then re-click the hint), then every candidate with
  the exact reject reason (`your flags send it to <member>` / `no group member matches`), inline
  `fix <flag>` chips that would change the verdict, and an explicit "do it anyway" button for the
  1A reset — nuclear is **never auto-jumped** unless it's the flag's sole writer (e.g.
  `p_pr=false`). a divert reject (`your flags send it to <member>`) also ends with
  `make <winner> lose: <chips>` — the AND-items of the winner's own guard (from `beatItems`),
  because breaking any single one lets the target win the group; rows show the same hint after
  `(target matches too, but an earlier member wins)`. the 1A reset shows its red `INTRO RESET — wipes
  EVERY state flag` line because it clears your whole save. a hint with no known stop renders as a
  dotted `rc-nostop` span, never a dead button. capture-phase listener: the chips sit inside
  clickable step rows AND inside the dismissable banner, so the chip handler must
  `stopPropagation` before the row's jump handler / banner dismiss runs.
  headless coverage: `C:\tmp\rctest\index5.html` (chips, banner, goto, nuclear) and
  `index6.html` (ranked stops: shape, loud no-fit + guided-recovery chip, guard-aware pick).
- `progress-tracker.js` — backtick toggles the stats overlay. trust the **segments** and
  **choice-points** rows. the **states** row is broken (it counts every key including absent
  ones, so it always reads 100%) — don't report it as real.

keys `C` / `N` / backtick are registered with `addEventListener`, so they don't collide with the
player's `document.onkeypress` bindings (F, R, K, J, L, Space, arrows).

## planner notes (`tools/route-planner.js`)

simulation from the dumped save: A* per fresh segment + a state-repair search when a segment
isn't enterable. things that were fixed once and must stay fixed:

- `outsFor` must include the selfgroup branch (`resolveSegmentGroup(prevSegment)`), not just
  `nextChoice` / `defaultNext`.
- transitions resolve the segment group **before** applying the choice's impression
  (`playNextSegment` order: nextChoice → selfgroup → defaultNext).
- impressions apply only when the segment was *played into*, never when seeked to
  (`momentStart(m, seeked)`).
- `applyImpression` must tolerate `data` without a `persistent` block: 9 shipped choices carry
  `{type:'userState', data:{}}` (SS21 `'PROGRAM & CONTROL'`, SS22 `"WHO'S THERE?"`, the
  `EXIT TO CREDITS` trio, …). `Object.entries(undefined)` threw inside `playNextSegment`
  **after** `nextChoice` was consumed, so the click cleared the button list, skipped the jump
  and left the moment active — the choice looked dead ("i'm clicking it but the scene isn't
  jumping"). keep the `|| {}` guard.
- brute force over flag combinations must handle enum flags (`p_ps`, `p_vs`, `p_pc`), not only booleans.
- `canEnter` must be driven by the *dynamic* predecessor (`defSrc` / `chSrc` / `grpSrc`), not the
  static `incoming` list — the static list contains unconditional `default` edges and lets you
  "enter" segments you actually can't.
- keep state dedup to a parent-pointer BFS with a cap, or the full-state set OOMs.
- `MAXEXP` env var caps expansions when a run gets too slow.
- a moment with `defaultChoiceIndex` whose window reaches the segment end **auto-fires at the
  boundary** — `addChoices` stamps `nextChoice` at `momentStart` and `momentEnd` (which would
  reset it) runs only after `playNextSegment`, so the choice branch beats `defaultNext` and
  resolves the choice's GROUP by flags. e.g. watching `SS52` out does NOT walk to its
  `defaultNext` `Z7c`: the `CHOP OR BURY?` default fires into `chopBuryRecap`
  (`Z7a, Z7b, Z7e, Z7f, Z7c, Z7d`) — with `p_vs !== 'k'` you land `Z7e`/`Z7f`, which never clear
  `p_cd`, so a bare "watch SS52" fix for `p_cd` only works while `p_vs === 'k'`.
  `tools/mkchains.js` records these hops through `autoChoiceHop()` as guarded stops
  (`guard` = the group order, `targets` = the members that write the flag).

## why a landing can flip under "flags ok"

`splitScreens` order is fixed (`SS12 … SS9, SS4, SS22, SS21, SS5, respawnOptions`) and the player
picks the **first** member whose precondition passes. `SS22` sits after `SS2…SS9`, and all of those
require `!p_ty` — so `8B → SS22` (chain 3) is reachable only while `p_ty` is true. `p_ty` is set
only by the `8J` moment at 1:17:58 (seek `ZK3` 4:00:14 → click `TOY` at 4:00:30 → watch ~3s) and
cleared only by the `1A` intro reset, so any 1A-starting setup/chain run after it silently breaks
chain 3's landing. same shape applies to other split-screens targets: check the row's live flags,
not just whether the target's own precondition passes.

## headless check of the console

`msedge.exe` is a launcher: `& $edge ... --dump-dom` returns as soon as the launcher exits, so the
captured output is empty and every assert looks like a miss. run it with
`Start-Process -FilePath $edge -ArgumentList @(...) -Wait -PassThru -NoNewWindow
-RedirectStandardOutput <file>` and read the file. always give it a fresh `--user-data-dir` (a
reused profile serves cached JS and the build stamp silently stays old) and point it at a scratch
page — `C:\tmp\rctest\index2.html`, served on 8001 — that seeds `persistentState_*` keys, loads
`route-data.js` + `route-console.js` from 8000, and writes the assert result into a `data-out`
body attribute for a regex.

## shipping

commit + push after a task is done (rule: always push, then say you pushed). route/doc changes
go straight to the current branch. no personal secrets, no save dumps, no account tokens in the repo.
