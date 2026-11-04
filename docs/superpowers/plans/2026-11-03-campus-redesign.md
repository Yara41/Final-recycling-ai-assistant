# Campus Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the toy-like Living Campus with the approved realistic limestone campus that follows the visitor's local time, rebuild Home, Agent and the sorting game on it, and make all copy Modern Standard Arabic.

**Architecture:** Pure, unit-tested modules decide everything that can be decided without WebGL (time of day, campus composition, camera shots, game rules, card effects). A react-three-fiber `Scene` renders the composed campus from those decisions and exposes a small imperative API (project, flight, lids, report bin). Pages own their story (scroll progress, chat cards, game rounds) and drive the scene through that API. Weak devices get pre-rendered stills.

**Tech Stack:** React 19, Vite 7, three 0.186.1 + @react-three/fiber 9.8.1 (no drei), Supabase (Postgres + Deno Edge Functions), node:test, PGlite, Deno test, Playwright (SwiftShader).

**Spec:** `docs/superpowers/specs/2026-11-03-campus-redesign-design.md`. Visual reference: `docs/superpowers/prototypes/2026-11-03/` (`engine.js` holds the approved geometry, materials, colours and sky keys; port from it, do not reinvent).

## Global Constraints

- All Arabic UI copy is Modern Standard Arabic; the agent is "الوكيل الذكي" / "الوكيل"; "الإيجنت" appears nowhere.
- No thesis details anywhere (no study numbers, β, or research section).
- Phone first: no horizontal scroll at 360, 390 and 1366 px, Arabic and English.
- Initial JS ≤ 250 KB gzip; three.js only in lazy chunks.
- Free tiers only; no new paid services or assets.
- Phases and boundaries: night < 4:45, dawn 4:45–7:00, day 7:00–16:30, sunset 16:30–19:30, night ≥ 19:30; timeline `[0 night, 4.75 night, 6 dawn, 7.5 day, 16.5 day, 18 sunset, 19.5 night, 24 night]`, smoothstep between points.
- Theme follows the scene phase (`<html data-phase>` + `dark` class), not `prefers-color-scheme`.
- Reduced motion: no camera drift, sway or grain animation; the still image replaces the live scene.
- Colours: sky `#2fb3e3`→`#e4f5fb`, ink `#13284a`, lime `#c6f36b`, leaf `#0f6b4a`, amber `#ffb547`, limestone `#e6d6b8`. Fonts: El Messiri, IBM Plex Sans Arabic, Caveat + Instrument Serif (logo only).

## Review Focus

1. A visitor whose clock crosses a phase boundary while the page is open (auto mode) sees the sky change within a minute with no jump; covered in Task 1 (`skyAt` continuity) and Task 5 (minute refresh).
2. A university with zero faculties, or more than six, or bins all marked drop-off, still renders a complete plaza; covered in Task 3.
3. A logged card whose `bin` is missing or not one of the plaza bins still produces a flight (to the first plaza bin); covered in Task 7.
4. `localStorage` throwing (private mode) must not break the clock button; covered in Task 1.
5. Long Arabic agent replies and action-card titles on a 360 px phone with the sheet expanded never scroll sideways; covered in Task 7.

---

### Task 1: Time of day and phase theme

**Files:**
- Create: `src/campus/timeOfDay.js`, `src/campus/useSky.js`, `src/campus/ClockButton.jsx`, `src/campus/__tests__/timeOfDay.test.js`
- Modify: `src/theme/tokens.css` (replace the `prefers-color-scheme` block with `:root.dark { … }` using the same tokens)

**Interfaces:**
- Produces: `phaseAt(hour: number): 'night'|'dawn'|'day'|'sunset'`; `skyAt(hour): Sky` where `Sky = { top, hor, fog, sun: string, sunIntensity, hemiIntensity, elevation, azimuth, windows: number, dark: boolean }` (key values from `engine.js` `KEYS`); `MODES = ['auto','day','sunset','night','dawn']`; `nextMode(mode)`; `skyFor(mode, hour): Sky` (fixed key for non-auto modes); `useSky(): { mode, phase, sky, cycle() }` (reads/writes `localStorage['ecowaste-sky-mode']` in try/catch, refreshes every 60 s in auto, sets `document.documentElement.dataset.phase` and toggles class `dark` from `sky.dark`); `<ClockButton lang />` (uses `useSky`, `aria-label` "وقت المشهد: تلقائي"/"Scene time: auto", icon per phase).

- [ ] **Step 1: Write failing tests** `phase boundaries` (`phaseAt(4.7)==='night'`, `phaseAt(4.75)==='dawn'`, `phaseAt(7)==='day'`, `phaseAt(16.5)==='sunset'`, `phaseAt(19.5)==='night'`), `sky is continuous` (for h in 0..24 step 0.01, adjacent `sunIntensity` differ by < 0.05; `skyAt(0)` deep-equals `skyAt(24)`), `manual modes return their key` (`skyFor('night', 12).dark === true`, `skyFor('day', 2).windows === 0`), `nextMode cycles` (`auto→day→sunset→night→dawn→auto`), `useSky survives storage errors` (stub `localStorage.getItem` to throw; `readMode()` returns `'auto'`; export `readMode`/`writeMode` for this).
- [ ] **Step 2: Run** `node --test src/campus/__tests__/timeOfDay.test.js` → FAIL (module missing).
- [ ] **Step 3: Implement** the modules; colours interpolate in linear RGB via a small `mixHex(a, b, k)` helper (no three.js import in `timeOfDay.js`).
- [ ] **Step 4: Run** `npm run test:web` → PASS; `npm run lint` → 0 errors.
- [ ] **Step 5: Commit** `feat(campus): time of day from the visitor's clock`.

### Task 2: Language, copy and backend card fields

**Files:**
- Rewrite: `src/pages/copy.js` (nav, home 5 screens, game, footer; ar + en), `src/agent/strings.js` (MSA, "الوكيل", role suggestions in MSA)
- Create: `src/campus/text.js` (scene labels: bin names, "تم إرسال البلاغ ✓", "ليست هنا"), `src/lib/__tests__/copy.test.js`
- Modify: `supabase/functions/agent/prompt.ts` (MSA rule), `supabase/functions/agent/tools/log_recycling.ts` (card `bin: bin`), `supabase/functions/agent/types.ts` (`bin?: string`), `supabase/functions/tests/agent_tools.test.ts`, `supabase/functions/tests/agent_loop.test.ts` (prompt assertion)

**Interfaces:**
- Produces: `copy(lang).home.screens: Array<{ kicker, title: [before, accent, after], text?, cta?: string[] }>` with the five screens verbatim from the spec table; `copy(lang).game: { title, rounds, score, wrong, right, end: { title, play, ask } }`; `strings(lang).agent.empty = { title: 'مرحباً، ماذا ستتخلّص منه اليوم؟', sub: 'التقط صورة للغرض، أو اكتب سؤالك.' }`; logged card `{ kind:'logged', bin: string, … }`.

- [ ] **Step 1: Write failing tests:** `no dialect in Arabic copy` (walk every string reachable from `copy('ar')`, `strings('ar')` and `text.js` Arabic exports; fail on any of `وين شو هلق هلأ بدك بدي مليانة مليان كتير هيك لسا منيح الإيجنت إيجنت` as whole words, or `صح` not followed by `يح`); `log_recycling card names its bin` (`r.card.bin === 'plastic'`); `prompt keeps Arabic replies formal` (`buildSystemPrompt(ctx)` contains `Modern Standard Arabic`).
- [ ] **Step 2: Run** `npm run test:web` and `npm run test:functions` → the three tests FAIL.
- [ ] **Step 3: Implement.** Prompt line to add: `- When replying in Arabic, always use Modern Standard Arabic, even if the user writes in a dialect.` Rewrite every Arabic string; keep keys used by existing components so the app still builds.
- [ ] **Step 4: Run** `npm run test:web`, `npm run test:functions`, `npm run lint`, `npm run build && npm run test:e2e` (update e2e locators that used old Arabic text, e.g. `/تحدث مع الإيجنت/` → `/تحدّث مع الوكيل/`) → all PASS.
- [ ] **Step 5: Commit** `feat(copy): Modern Standard Arabic everywhere, agent replies formally`.

### Task 3: Snapshot bins and campus composition

**Files:**
- Create: `supabase/migrations/20261103120000_snapshot_bins.sql`, `src/campus/compose.js`, `src/campus/__tests__/compose.test.js`
- Modify: `tests/sql/helpers.mjs` (apply the new migration), `tests/sql/campus_snapshot.test.mjs`, `tests/e2e/harness.mjs` (`SNAPSHOT.university.bins`)
- Delete: `src/campus/layout.js`, `src/campus/growth.js` and their tests once nothing imports them (Task 5 removes the last importer; delete there)

**Interfaces:**
- Consumes: snapshot shape from `campus_snapshot` plus `university.bins: Array<{ id, label_ar, label_en, color, accepts }>`.
- Produces: `composeCampus(snapshot, lang): { buildings: Building[], plazaBins: PlazaBin[], reportBin: { locationId } | null }`; `Building = { id: 'b-<slot>', slot: 0..5, faculty: string|null, label: string|null, x, z, ry, w, d, h, arches }` with the six slots from `engine.js` (main hall `x0 z-16 w22 h9.5 arches7`, west wing `x-19 z-2 ry=π/2 w16 h8 arches5`, east wing `x19 z-3 ry=-π/2 w16 h11 arches5`, corner halls `±24, z-26, ry ±0.5, w12`, far hall `x0 z-40 w18 h8 arches6`); `PlazaBin = { id, label, color }` (max 4, `accepts` not only `glass`/`hazardous`, ordered as configured); `GAME_BINS` constant (general `#4b5563`, paper `#2f8f4e`, plastic `#1f6fd1`, metal `#d9a514`, labels from `text.js`).

- [ ] **Step 1: Write failing tests:** SQL `snapshot includes the university bins` (`snap.university.bins` length 5 for the demo, still no `user_id` key anywhere); unit `faculties fill slots by points` (Engineering 300 → slot 0, Business 200 → slot 1), `more than six faculties keeps the top six`, `no faculties gives six unnamed halls` (`label === null`), `plaza bins skip drop-off bins and keep order` (demo bins → `['general','plastic','paper','metal']`), `all bins drop-off falls back to GAME_BINS`, `an open report adds the report bin` (`reportBin.locationId === 'l1'`), `labels follow lang`.
- [ ] **Step 2: Run** `npm run test:sql` and `npm run test:web` → FAIL.
- [ ] **Step 3: Implement** the migration (`create or replace function public.campus_snapshot` adding `'bins', v_uni.bins` to the `university` object; same grants) and `compose.js`.
- [ ] **Step 4: Run** both suites → PASS.
- [ ] **Step 5: Commit** `feat(campus): compose a plaza campus from university data`.

### Task 4: Camera shots and card effects

**Files:**
- Create: `src/campus/camera.js`, `src/campus/__tests__/camera.test.js`
- Rewrite: `src/campus/effects.js`, `src/campus/__tests__/effects.test.js`

**Interfaces:**
- Produces: `layoutFor(width): 'phone'|'wide'` (≤ 640 → phone); `SHOTS[layout]: { home: Shot[5], agent: Shot, report: Shot, game: Shot }` with `Shot = { p: [x,y,z], l: [x,y,z] }` copied from the approved prototypes (`home.html` `SHOTS`, `agent-and-game.html` `VIEWS`); `shotAt(shots: Shot[], progress: number): Shot` (smoothstep between `floor` and `ceil`, clamped); `effectsForCards(cards, { plazaBins }): Effect[]` with `Effect = { type:'flight', binId, points } | { type:'report' } | { type:'resolved' }`.
- [ ] **Step 1: Write failing tests:** `shotAt clamps` (`shotAt(s, -1)` = `s[0]`, `shotAt(s, 99)` = last), `shotAt halfway is the midpoint` (`progress 0.5` between two shots gives the arithmetic midpoint), `logged with points flies to its bin`, `unknown bin flies to the first plaza bin`, `logged with 0 points gives no flight`, `report and audit-with-report give report`, `resolved gives resolved`.
- [ ] **Step 2: Run** `npm run test:web` → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(campus): camera shots and card effects for the new scene`.

### Task 5: The realistic scene, container and stills

**Files:**
- Create: `src/campus/scene/{materials.js, architecture.js, nature.js, furniture.js, Scene.jsx}`, `src/campus/CampusStill.jsx`, `scripts/render-stills.mjs`, `public/campus/{dawn,day,sunset,night}-{wide,phone}.webp`
- Rewrite: `src/campus/Campus.jsx`, `src/campus/campus.css`
- Delete: `src/campus/{CampusScene.jsx, CampusFallback.jsx, Eco.jsx, Flight.jsx, layout.js, growth.js}` and tests that only cover them
- Test: `tests/e2e/campus.e2e.mjs` (rewrite)

**Interfaces:**
- Consumes: `composeCampus`, `GAME_BINS` (Task 3), `useSky` (Task 1), `shotAt`/`SHOTS`/`layoutFor` (Task 4), `fetchSnapshot` (`src/campus/data.js`, unchanged), `shouldUse3D`/`detectDevice` (`gate.js`, unchanged, `?3d=1|0` override kept).
- Produces: `<Campus universityId lang shot={Shot} bins="plaza"|"game" onApi={(api|null) => void} onSnapshot children />` rendering `<div class="campus" data-renderer="3d"|"still">` full-bleed; `api = { project(v3: [x,y,z]): {x,y,visible}, binTop(binId): [x,y,z], flight(binId, t: number|null), lid(binId), setReport(on: boolean), reportTop(): [x,y,z] }`. `CampusStill` shows `/campus/<phase>-<layout>.webp` with `alt` "حرم جامعي من الحجر عند <phase>".
- Scene rules: port geometry/materials/sky from `engine.js` (ashlar texture, arcade `ExtrudeGeometry`, cypress lathe, olive canopy detail 2, lamps with point lights scaled by `sky.windows`, bins with canvas name labels, overflowing variant at the west wing when `reportBin` or `setReport(true)`); renderer: ACES, sRGB, exposure 0.9, `dpr` cap 1.75 phone / 2 wide, shadow map 1024 phone / 2048 wide; drift and sway off with reduced motion; `onContextLost` → still.

- [ ] **Step 1: Write failing e2e:** `scene mounts with ?3d=1` (`.campus[data-renderer="3d"] canvas` and `.scene-wrap[data-ready]`), `context loss shows the still` (`.campus img[src*="/campus/"]`), `reduced motion shows the still` (`reducedMotion:'reduce'` without `?3d=1`), `still matches the forced phase` (clock button to night → `src` contains `night`), `three.js is not in the initial chunk` (keep the manifest test).
- [ ] **Step 2: Run** `npm run build && node --test --test-timeout=200000 tests/e2e/campus.e2e.mjs` → FAIL.
- [ ] **Step 3: Implement** the scene modules and container; then `scripts/render-stills.mjs` (Playwright + SwiftShader, opens `/?3d=1&still=<phase>` at 1600×900 and 800×1400, waits for `data-ready`, screenshots to WebP via `ffmpeg -q:v 80`) and run it once to commit the eight stills (each ≤ 180 KB).
- [ ] **Step 4: Run** e2e file, `npm run test:web`, `npm run lint`, and check `dist/.vite/manifest.json` entry gzip ≤ 250 KB → PASS.
- [ ] **Step 5: Commit** `feat(campus): realistic limestone campus with stills for weak devices`.

### Task 6: Home page story

**Files:**
- Rewrite: `src/pages/Home.jsx`, `src/pages/pages.css`
- Modify: `src/App.jsx` (top bar: logo, nav, `ClockButton`, language switch; transparent over the scene on Home)
- Test: `tests/e2e/home.e2e.mjs` (new; move the home tests out of `campus.e2e.mjs`)

**Interfaces:**
- Consumes: `copy(lang).home.screens`, `<Campus shot onApi>`, `SHOTS[layout].home`, `shotAt`, `api.flight`, `api.setReport`, `api.project`, `api.reportTop`.
- Produces: five `<section class="screen" data-screen="0..4">` each `min-height: 100svh`; progress `p = scrollY / innerHeight` smoothed (k = 0.08, 1 with reduced motion); screen 2 shows the phone-camera card with `/items/bottle.webp`, scan line and result line; screen 3 drives `api.flight('plastic' or first plaza bin, clamp((p-1.2)/0.5))` and a "+10" tag; screen 4 `api.setReport(true)` and the tag "تم إرسال البلاغ ✓" at `api.reportTop()`; progress rail with five marks; CTA buttons route to Agent and Learn.

- [ ] **Step 1: Write failing e2e:** `home has five screens with the approved headlines` (Arabic h1 contains "تتنفّس"; `[data-screen]` count 5), `scrolling to screen 3 shows +10`, `screen 4 shows the report tag`, `nothing covers the hero headline` (the camera card is hidden at `p=0`: `getComputedStyle(card).visibility === 'hidden'`), `clock button switches phase` (click until `html[data-phase="night"]`), `CTA opens the agent and the game`, `no horizontal scroll at 360/390/1366 in ar and en`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm run build && npm run test:e2e` → PASS.
- [ ] **Step 5: Commit** `feat(home): five-screen campus story`.

### Task 7: Agent screen on the campus

**Files:**
- Modify: `src/agent/AgentPage.jsx`, `src/agent/AgentChat.jsx`, `src/agent/ActionCard.jsx`, `src/agent/ImpactPage.jsx` (adds "أسبوعك على الحرم"), `src/agent/FacilitiesPage.jsx`, `src/agent/AdminPage.jsx`, `src/agent/Onboarding.jsx`, `src/agent/agent.css`, `src/campus/Replay.jsx` (targets buildings by faculty via `api.project` of the building roof)
- Test: `tests/e2e/agent.e2e.mjs`, `tests/e2e/dashboard.e2e.mjs`

**Interfaces:**
- Consumes: `effectsForCards`, `<Campus shot={SHOTS[layout].agent | .report} onApi>`, `api.flight`, `api.lid`, `api.setReport`, `strings(lang).agent`.
- Produces: bottom sheet (phone, max 56 %, drag/tap to full height, `aria-expanded` on the handle "توسيع المحادثة"/"تصغير المحادثة") or 420 px panel (≥ 900 px); lime camera button `aria-label` "التقط صورة" opening the file input; points chip counting up by earned points; flight animated over 900 ms then "+N" tag for 1.6 s; report → camera to `report` shot and tag; resolved → `setReport(false)`.

- [ ] **Step 1: Update and add e2e:** existing agent/dashboard specs pass with the new labels; `camera button opens the photo picker` (`page.waitForEvent('filechooser')`), `logged card flies to its bin and shows +10` (mock card `{kind:'logged', bin:'plastic', points:10}`), `unknown bin still shows +10`, `report card shows the report tag`, `points chip adds earned points` (impact 120 → 130), `360px Arabic with long replies has no horizontal scroll` (keep the existing test, sheet expanded), `My impact plays your week` (button → `role=dialog` "أسبوعك").
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm run build && npm run test:e2e`, `npm run lint` → PASS.
- [ ] **Step 5: Commit** `feat(agent): agent sheet on the realistic campus`.

### Task 8: Sorting game

**Files:**
- Create: `src/pages/game/rules.js`, `src/pages/game/SortingGame.jsx`, `src/pages/game/game.css`, `src/pages/__tests__/rules.test.js`
- Modify: `src/pages/Learn.jsx` (renders the new game full-screen over `<Campus bins="game" shot={SHOTS[layout].game}>`)
- Delete: `src/components/SortingGame.jsx`, `src/components/SortingGame.css`
- Test: `tests/e2e/game.e2e.mjs`

**Interfaces:**
- Consumes: `GAME_BINS`, `api.binTop`, `api.project`, `api.lid`, `copy(lang).game`.
- Produces: `ITEMS` (8 entries in this order: bottle→plastic, chips→general, can→metal, pizza→general, paper→paper, tissue→general, cardboard→paper, banana→general; each `{ id, image: '/items/<id>.webp', name: {ar,en}, bin, rule: {ar,en} }` with the rule texts from the approved prototype); `answer(state, binId): { state, correct: boolean, points: 0|10 }`; `initialState()`; `isOver(state)`; end text "النتيجة <n> من ٨" with Arabic-Indic digits in Arabic.
- Behaviour: drag the card onto a bin (nearest projected bin within `max(90px, 12vw)`) or tap a bin button (buttons `dir="ltr"` so they line up with the bins); card flies to the bin, lid opens, "+10" or "ليست هنا" tag for 1.3 s, result line in `role="status"` with the rule on a wrong answer; next round after 2.3 s; end panel with "العب مرة أخرى" and "اسأل الوكيل".

- [ ] **Step 1: Write failing tests:** unit `eight items in the approved order`, `right answer adds ten`, `wrong answer adds nothing and reports the right bin`, `game ends after eight answers`; e2e `play a full game` (answer all eight correctly via buttons → "النتيجة ٨ من ٨"), `a wrong answer shows the right bin and the rule`, `play again resets to round ١`, `drag onto a bin answers` (drag the card to the projected plastic bin on round 1 → "+10").
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm run test:web`, `npm run build && npm run test:e2e` → PASS.
- [ ] **Step 5: Commit** `feat(game): sorting game in front of the campus bins`.

### Task 9: Review sweep, backend rollout and PR

**Files:**
- Create: `scripts/review-shots.mjs` (4 phases × [home screens 0–4, agent, agent after a logged card, game round 1, game end] × [390×844, 1366×820], Arabic; plus English home at 390; saves to the scratchpad)
- Modify: `docs/AGENT_SETUP.md` (migration list adds `20261103120000_snapshot_bins.sql`; MSA rule; clock button), `README.md`

- [ ] **Step 1: Run** `node scripts/review-shots.mjs <outdir>` and inspect every image; fix anything unreadable, overlapping, cut off or misaligned; re-run only the affected shots.
- [ ] **Step 2: Run the full suite:** `npm run test:sql`, `npm run test:functions`, `npm run test:web`, `npm run lint`, `npm run build` (record entry gzip), `npm run test:e2e` → all PASS.
- [ ] **Step 3: Apply** `20261103120000_snapshot_bins.sql` to Supabase project `uwxksbwlzjrjlccbdjtk` and verify `select campus_snapshot('00000000-0000-4000-8000-000000000001')->'university'->'bins'` returns 5 bins; redeploy the `agent` function (full bundle as in previous deploys).
- [ ] **Step 4: Commit** `docs: campus redesign setup`, push, open the PR to `main` with the review screenshots summary and the deploy-preview link for the owner to check on her phone.
