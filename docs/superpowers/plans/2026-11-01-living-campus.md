# Living Campus Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current UI with the "Living Campus" identity: a data-driven 3D campus that reacts to agent actions, a bottom-sheet agent chat, a weekly replay, and restyled pages.

**Architecture:** Pure modules (`layout`, `growth`, `replay`, `effects`, `gate`) turn an anonymised `campus_snapshot` into scene data; a lazily loaded react-three-fiber scene renders it, with an SVG fallback for weak devices and as the loading state. The agent chat emits action cards that become campus effects.

**Tech Stack:** React 19, Vite 7, three 0.186.1, @react-three/fiber 9.8.1, @react-three/drei 10.7.9, Supabase (Postgres function), node:test, Playwright, PGlite.

**Spec:** `docs/superpowers/specs/2026-11-01-living-campus-design.md`

## Global Constraints

- Colours only through the tokens in spec §2 (`--ink --leaf --lime --sky --paper --card --amber --muted`), light and dark.
- Fonts: Alexandria (display), IBM Plex Sans Arabic (body) from Google Fonts with system fallbacks.
- Arabic RTL and English LTR everywhere; all motion off under `prefers-reduced-motion`.
- No 3D code in the initial chunk (`React.lazy`); initial JS ≤ 250 KB gzip.
- 3D only when WebGL2, no reduced motion, and `hardwareConcurrency >= 4` or unknown; else `CampusFallback`.
- Growth: trees per faculty `min(12, floor(points_30d / 40))`; litter `min(4, floor(wrong_items_30d / 10))`.
- Replay lasts 20 s; `events_7d` capped at 500, newest first.
- Snapshot contains no user ids; members of the university, or anyone for `public_demo` universities.
- Exact dependency versions above (pinned with `-E`).
- Nothing is applied to Supabase or deployed without the PR merge / owner approval (already granted for Supabase migrations in this project).

## Review Focus

1. A university with **0 locations** → campus still renders ground + "no buildings yet" text, no crash. Test in Task 2 (`layout([])`) and Task 4 (fallback renders).
2. Locations **without lat/lng** mixed with ones that have them → all placed, none overlapping. Test in Task 2.
3. **WebGL context lost** mid-session → fallback replaces the scene without reload. Test in Task 5 (simulated `webglcontextlost`).
4. **Snapshot request fails** → fallback with an "offline" chip; chat still sends. Test in Task 4 (e2e, 500 on rpc).
5. **Phone width 360 px in RTL** with the sheet expanded → no horizontal scroll, input reachable. Test in Task 7 (e2e).

---

## File Structure

```
supabase/migrations/20261102120000_campus_snapshot.sql   public_demo + campus_snapshot()
tests/sql/campus_snapshot.test.mjs
src/theme/tokens.css                                     tokens, fonts, base
src/campus/layout.js  growth.js  replay.js  effects.js  gate.js   pure logic
src/campus/__tests__/*.test.js                           node:test
src/campus/data.js                                       fetch snapshot
src/campus/CampusFallback.jsx  Campus.jsx  CampusScene.jsx  Eco.jsx  Flight.jsx  campus.css
src/pages/Home.jsx  Learn.jsx  pages.css
src/agent/*                                              restyled; AgentChat → bottom sheet
src/App.jsx                                              slim shell + page switch
tests/e2e/campus.e2e.mjs                                 new; existing e2e updated
```

---

### Task 1: `campus_snapshot` data function

**Files:** Create `supabase/migrations/20261102120000_campus_snapshot.sql`, `tests/sql/campus_snapshot.test.mjs`; Modify `tests/sql/helpers.mjs` (apply new migration), `supabase/seed/demo_university.sql` (`public_demo = true` for the demo university).

**Interfaces:**
- Produces: `public.universities.public_demo boolean not null default false`; `public.campus_snapshot(p_university uuid) returns jsonb` (security definer, stable) with keys `university {id,name}`, `locations[] {id,name,kind,faculty,lat,lng}`, `faculties[] {faculty,points_30d,items_30d,correct_rate_30d,wrong_items_30d}`, `events_7d[] {created_at,location_id,faculty,category,correct_bin,verification,quantity}`, `open_reports[] {location_id,issue,contamination_pct}`. Raises `insufficient_privilege` unless caller is service_role, a member of that university, or the university is `public_demo` and active. Granted to `anon, authenticated, service_role`.

- [ ] Step 1: tests: `members get their campus`, `another university's member is refused`, `anon reads the public demo campus`, `anon is refused a non-demo university`, `snapshot never contains user ids` (assert JSON text has no `user_id`/`reporter_id`), `events_7d is capped at 500 and newest first`, `faculties sums match recycling_events for 30 days`.
- [ ] Step 2: `npm run test:sql` → new tests FAIL (function missing).
- [ ] Step 3: write migration + seed flag + helper.
- [ ] Step 4: `npm run test:sql` → all PASS.
- [ ] Step 5: commit `feat(db): anonymised campus snapshot`.

### Task 2: Pure campus logic

**Files:** Create `src/campus/layout.js`, `growth.js`, `replay.js`, `gate.js`, `src/campus/__tests__/{layout,growth,replay,gate}.test.js`; Modify `package.json` `test:web` glob to `src/**/__tests__/*.test.js`.

**Interfaces:**
- `layoutCampus(snapshot) -> { size: number, buildings: Building[], kiosks: Kiosk[] }` where `Building = { id, faculty, x, z, w, d, h, color }` (one per faculty, at the centroid of its locations), `Kiosk = { id, locationId, kind, x, z, buildingId|null }` (one per `bin_station`/`drop_off` location). Units: world grid of 1 = 1 m-ish; `size` = ground side. Deterministic (same input → same output); no two footprints overlap (≥ 1 unit gap); locations with lat/lng projected (equirectangular around their mean) and scaled into the grid; ones without coordinates placed on a ring. Faculty `null` → `"Campus"` group.
- `growthFor(faculty) -> { trees: number, treeScale: number, litter: number }` with spec values; `treeScale = 0.7 + 0.6 * correct_rate_30d`.
- `replayFrames(events, { durationMs = 20000 }) -> Frame[]` where `Frame = { atMs, locationId, faculty, kind: 'good'|'wrong'|'self' }` sorted oldest→newest, `atMs` spread linearly over the duration; empty input → `[]`.
- `shouldUse3D({ webgl2: boolean, reducedMotion: boolean, cores: number|undefined }) -> boolean`.

- [ ] Step 1: tests (exact): `layout is deterministic`; `no overlapping footprints for 40 locations`; `locations without coordinates still placed`; `empty snapshot gives no buildings and size 20`; `one building per faculty`; `growth caps at 12 trees and 4 litter`; `growth with zero data is 0 trees 0 litter scale 0.7`; `replay orders oldest first and last frame at 20000 ms`; `replay of empty week is []`; `gate false on reduced motion, false without webgl2, false with 2 cores, true with unknown cores`.
- [ ] Step 2: `npm run test:web` → FAIL.
- [ ] Step 3: implement.
- [ ] Step 4: `npm run test:web` → PASS.
- [ ] Step 5: commit `feat(campus): layout, growth, replay and device gate`.

### Task 3: Theme, shell, Home and Learn pages

**Files:** Create `src/theme/tokens.css`, `src/pages/Home.jsx`, `src/pages/Learn.jsx`, `src/pages/pages.css`, `src/i18n.js` (moves the `EN` dictionary + `tr` out of App.jsx as `t(lang, arText)`); Modify `src/App.jsx` (header with logo, AR/EN toggle, nav: Home / Agent / Learn; page switch only), `src/main.jsx` (import tokens.css), `index.html` (fonts preconnect); Delete legacy sections and `src/App.css` rules no longer referenced; remove `JordanUniversityMap` import from Home.

**Interfaces:** `Home({ lang, onStart })`, `Learn({ lang, onAsk })` (keeps `SortingGame`). Home shows `<Campus mode="showcase" universityId={DEMO_UNI} />` (from Task 4), headline, buttons "تحدث مع الإيجنت"/"Talk to the agent" and "كيف يعمل"/"How it works", three value blocks (صوّر / سجّل / شوف أثرك), numbers strip from the snapshot (`items 30d`, `correct %`, `est. kg CO₂e`).

- [ ] Step 1: e2e `tests/e2e/campus.e2e.mjs`: `home shows headline and a campus fallback before 3D`; `language toggle switches dir to ltr and back`; `nav reaches agent and learn`; existing e2e opener updated to the new "Talk to the agent" button.
- [ ] Step 2: build + `npm run test:e2e` → FAIL.
- [ ] Step 3: implement (Campus may be a stub that renders `CampusFallback` until Task 4).
- [ ] Step 4: lint (new files clean, App.jsx clean), build, e2e PASS.
- [ ] Step 5: commit `feat(web): living-campus theme, shell, home and learn`.

### Task 4: Campus container, data and fallback

**Files:** Create `src/campus/data.js`, `CampusFallback.jsx`, `Campus.jsx`, `campus.css`.

**Interfaces:**
- `fetchSnapshot(universityId, client?) -> Promise<Snapshot>` (rpc `campus_snapshot`).
- `<CampusFallback layout growthByFaculty pins />`: isometric SVG drawn from `layoutCampus` output; empty layout shows "لا توجد مباني بعد / No buildings yet".
- `<Campus mode="showcase"|"agent" universityId effects={Effect[]} onReady? />`: loads snapshot, computes layout/growth, chooses `CampusScene` (lazy) via `shouldUse3D`, otherwise fallback; on fetch error shows fallback + chip "غير متصل / Offline".

- [ ] Step 1: e2e: `campus fallback draws one building per faculty from the snapshot`; `snapshot error shows the offline chip and chat still sends` (Review Focus 4); `empty university shows no-buildings text` (Review Focus 1).
- [ ] Step 2: FAIL. Step 3: implement. Step 4: PASS + lint + build.
- [ ] Step 5: commit `feat(campus): data loading and illustrated fallback`.

### Task 5: 3D scene and Eco

**Files:** Create `src/campus/CampusScene.jsx`, `src/campus/Eco.jsx`; Modify `package.json` (`three@0.186.1`, `@react-three/fiber@9.8.1`, `@react-three/drei@10.7.9`, all `-E`).

**Interfaces:** `<CampusScene layout growthByFaculty pins ecoTarget ecoText onContextLost />` (default export, lazy): orthographic isometric camera, gentle auto-rotate (off under reduced motion), flat-shaded boxes for buildings, cones on cylinders for trees (count/scale from growth), small grey piles for litter, lime/amber spheres for pins, Eco (leaf body + eyes) tweening to `ecoTarget` building and showing `ecoText` via drei `Html`. Calls `onContextLost` on `webglcontextlost`.

- [ ] Step 1: e2e (3D forced via `?3d=1` query that bypasses the gate for tests): `3d scene mounts a canvas`; `context loss swaps to the fallback` (dispatch `webglcontextlost` on the canvas; Review Focus 3); `initial chunk excludes three` (assert no `three` in the entry chunk file list from `dist/.vite/manifest.json`).
- [ ] Step 2: FAIL. Step 3: implement (enable `build.manifest: true`). Step 4: PASS; screenshot desktop+phone for review.
- [ ] Step 5: commit `feat(campus): 3D living campus with Eco`.

### Task 6: Agent actions become campus effects

**Files:** Create `src/campus/effects.js`, `src/campus/Flight.jsx`, `src/campus/__tests__/effects.test.js`; Modify `src/agent/AgentChat.jsx` (prop `onActions(cards)`), `Campus.jsx` (consume effects).

**Interfaces:** `effectsForCards(cards, { layout, profileFaculty }) -> Effect[]` with `Effect = { type: 'flight'|'pin'|'unpin'|'eco', buildingId, points?, tone?: 'good'|'warn', text? }`: `logged` with `points>0` → `flight` (+points) to the card's location building, else the user's faculty building, else the first building; `logged` with 0 points → `eco` only; `report`/`audit` → `pin` warn; `resolved` → `unpin`; always one `eco` effect targeting the same building. `<Flight from={DOMRect} to={DOMRect} points />` animates a bottle icon along an arc (700 ms) then shows `+N`; reduced motion → shows `+N` only.

- [ ] Step 1: tests: unit `logged with points gives a flight to the faculty building`; `unknown location falls back to faculty then first building`; `report gives a warn pin`; `resolved gives unpin`; e2e `logging an item shows a flight and +10` (mock agent reply with a logged card, assert `.flight` then text `+10`).
- [ ] Step 2: FAIL. Step 3: implement. Step 4: PASS.
- [ ] Step 5: commit `feat(campus): agent actions animate the campus`.

### Task 7: Agent screen as bottom sheet + restyled pages

**Files:** Modify `src/agent/AgentPage.jsx` (layout: campus behind, top bar with points from `my_impact` and "أسبوعك/Your week", segmented control replacing tabs), `AgentChat.jsx` (bottom sheet: collapsed = input + last reply, expanded = history; drag handle and button), `Onboarding.jsx`, `ImpactPage.jsx`, `FacilitiesPage.jsx`, `AdminPage.jsx`, `ActionCard.jsx`, `agent.css` → rewritten on tokens.

- [ ] Step 1: e2e updates: existing agent/dashboard specs pass with new structure (selectors by role/name); new `sheet expands and collapses`; `phone 360px RTL has no horizontal scroll with sheet expanded` (Review Focus 5: `document.documentElement.scrollWidth <= 360`).
- [ ] Step 2: FAIL. Step 3: implement. Step 4: all e2e PASS, lint, build; screenshots light/dark, AR/EN, phone/desktop.
- [ ] Step 5: commit `feat(web): agent bottom sheet and restyled pages`.

### Task 8: "Your week" replay

**Files:** Create `src/campus/Replay.jsx`; Modify `AgentPage.jsx`, `Campus.jsx`.

**Interfaces:** `<Replay frames onFrame onDone />` drives a 20 s timeline (requestAnimationFrame), emitting `onFrame(frame)` → campus pin (good = lime, wrong = amber, self = grey) and a day label; pause/close buttons; empty frames → message "لا يوجد نشاط هذا الأسبوع بعد / No activity this week yet".

- [ ] Step 1: e2e: `your week plays and finishes` (clock fast-forward via `page.clock`), `empty week shows the message`.
- [ ] Step 2: FAIL. Step 3: implement. Step 4: PASS.
- [ ] Step 5: commit `feat(campus): weekly replay`.

### Task 9: Ship

**Files:** Modify `docs/AGENT_SETUP.md` (new migration), `README.md`; apply `20261102120000_campus_snapshot.sql` to Supabase and set `public_demo` on the demo university.

- [ ] Step 1: full suite: `npm run test:sql`, `npm run test:functions`, `npm run test:web`, lint, build (record initial chunk gzip size ≤ 250 KB), `npm run test:e2e`.
- [ ] Step 2: apply migration on Supabase; `select campus_snapshot('00000000-0000-4000-8000-000000000001')` returns buildings data.
- [ ] Step 3: commit, push, open PR.
