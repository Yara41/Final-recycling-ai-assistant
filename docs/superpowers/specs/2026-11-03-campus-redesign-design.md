# EcoWasteAI: Campus Redesign (realistic campus, local time of day, MSA copy)

Date: 2026-11-03. Status: approved direction, written for review.

## Why

The owner is entering the Dubai Chamber "Create AI Agents Championship" (Best Societal AI Agent).
She rejected the Living Campus look shipped in PR #5 as toy-like and generic: boxy buildings, a busy
landing page, and copy that reads as machine-made. She asked for an Awwwards-level, professional site
that stays visually calm, works first on phones, and has no mistakes.

She approved three working prototypes, which are the reference for this work:

- Directions board: https://claude.ai/artifact/W8XGvBFnPoBa7SGte3Xhuv (she chose A, daylight campus, combined with C, time of day).
- Homepage: https://claude.ai/artifact/6rRwyRruonxjwqmm6qpMja (version 3).
- Agent page and sorting game: https://claude.ai/artifact/TCYZ7y3Z3YbkMhpS5kF3Jb.

The prototype sources are kept in `docs/superpowers/prototypes/2026-11-03/`.

## What she said (requirements)

1. The campus must look real: Jordanian-style limestone buildings with arcades, cypress and olive trees, paving, real light and shadow. No toy shapes.
2. The scene follows the visitor's local clock: day in the daytime, night at night, plus dawn and sunset.
3. One idea per screen, little text, nothing cluttered. Fewer details.
4. No thesis details anywhere on the site (no study numbers, no β, no "research" section).
5. All Arabic copy is Modern Standard Arabic. No dialect (no وين، شو، هلق، بدك، مليانة …). This is a competition entry.
6. Phone size first. Nothing may scroll sideways; text must never be covered by the scene.
7. Keep the colours of the original banner (sky blue, lime, navy) unless something fits better.
8. Keep the sorting game, made much stronger.
9. Zero cost: free tiers only.

## Decisions made on her behalf (she said "do what you see fit")

- Arabic name for the agent: **الوكيل الذكي** (short form **الوكيل**), the standard translation of "AI agent". "الإيجنت" is removed everywhere.
- Users may still write to the agent in any dialect; the agent always replies in MSA (Arabic UI) or English (English UI).
- The page theme (light or dark text and surfaces) follows the scene's time phase, not the OS setting, so text is always readable over the sky.
- "Your week" replay moves from the top bar to the My impact page, to keep the agent screen calm.
- People figures are left out: close up they looked like toys.

## Visual identity

- Colours (tokens in `src/theme/tokens.css`): sky `#2fb3e3`→`#e4f5fb` (day sky), navy ink `#13284a`, lime `#c6f36b` (points, primary actions at night), leaf `#0f6b4a` (accent words by day), amber `#ffb547` (reports), limestone `#e6d6b8`.
- Type: El Messiri (display, Arabic), IBM Plex Sans Arabic (body), Caveat + Instrument Serif (logo only: "Eco" in script, "WasteAI" in serif).
- Light film grain over the scene (6 % opacity), disabled with reduced motion.
- Each screen: a small kicker, one headline (accent word coloured), at most one short sentence, at most two buttons.

## Time of day

`src/campus/timeOfDay.js` (pure, unit-tested):

- `phaseAt(hour)` → `'night' | 'dawn' | 'day' | 'sunset'` with boundaries night < 4:45, dawn 4:45–7:00, day 7:00–16:30, sunset 16:30–19:30, night ≥ 19:30.
- `skyAt(hour)` → interpolated state `{ top, hor, fog, sun, sunIntensity, hemiIntensity, elevation, azimuth, windows, dark }` between the key states night / dawn / day / sunset (values from the prototype), smoothstep-eased between timeline points `[0 night, 4.75 night, 6 dawn, 7.5 day, 16.5 day, 18 sunset, 19.5 night, 24 night]`.
- `modeState(mode, hour)`: `mode` is `'auto'` (default), `'day'`, `'sunset'`, `'night'` or `'dawn'`.
- The scene re-reads the clock every minute in auto mode.
- A round clock button in the top bar cycles auto → day → sunset → night → dawn. Its icon shows the current phase. The chosen mode is remembered in `localStorage` (guarded with try/catch).
- `document.documentElement.dataset.phase` and a `dark` class are set from the state, and the CSS tokens switch on them.

## The campus scene

Replaces `src/campus/CampusScene.jsx` (react-three-fiber stays, drei is not used) with a scene built from the prototype engine, split into focused modules in `src/campus/scene/`:

- `materials.js`: procedural canvas textures (ashlar limestone, paving, grass) and shared materials.
- `architecture.js`: `building({ w, d, h, arches })` with an extruded arcade, recessed back wall, cornice, and windows that glow at night.
- `nature.js`: cypress (lathe), olive (trunk plus canopy spheres), gentle sway.
- `furniture.js`: lamps (light at night), benches, bin sets with Arabic/English name labels drawn on canvas, an overflowing bin variant.
- `compose.js` (pure, unit-tested): `composeCampus(snapshot)` → `{ buildings: [{ id, faculty, slot, x, z, ry, w, d, h, arches }], plazaBins: [{ id, label, color }], reportBin: { locationId } | null }`. Faculties are sorted by 30-day points and assigned to six fixed slots around a central plaza (main hall north, two wings east and west, two corner halls, one far hall). Extra faculties are dropped from the scene (they still appear in data views). With no faculties, the plaza and default halls are shown unnamed. Plaza bins come from the university's own bins (first four that are not drop-off points, in their configured colours). If any report is open, the overflowing bin set appears beside the west wing.
- `camera.js` (pure, unit-tested): named shots per layout (`phone` ≤ 640 px, `wide`), linear interpolation with smoothstep between shots, plus a small idle drift and pointer parallax (off with reduced motion).
- `Scene.jsx`: one `<Canvas>`, `frameloop` always, pixel ratio capped at 1.75 on phones and 2 elsewhere, shadow map 1024 on phones and 2048 elsewhere, ACES tone mapping, sRGB output.
- Context loss and render errors fall back to the still image (below).

`campus_snapshot` gains `university.bins` (already public information) so the plaza shows the right bins. This is a small migration with a SQL test.

### Weak devices and reduced motion

Four pre-rendered stills (`public/campus/{dawn,day,sunset,night}.webp`, 1600 px wide, plus 800 px phone crops) made once by a script (`scripts/render-stills.mjs`) from the same scene. They are used when WebGL2 is missing, when the device reports fewer than 4 cores, when reduced motion is on, or after a WebGL context loss. The still matches the current phase.

## Pages

### Home (5 screens, scroll-driven camera)

| # | Kicker | Headline | Sentence | Scene |
|---|---|---|---|---|
| 1 | وكيل ذكي للاستدامة في جامعتك | جامعتك **تتنفّس** مع كل عبوة تُفرز بشكل صحيح | التقط صورة، ويتولّى الوكيل الذكي الباقي. Button: ابدأ مع الوكيل الذكي. Hint: مرّر للأسفل | Campus from above |
| 2 | التقط صورة | صورة واحدة، **والوكيل يعرف** | يحدّد لك الحاوية الصحيحة فوراً. | Plaza bins; phone-camera card with a real item photo, scan line, result "عبوة بلاستيكية ← الحاوية الزرقاء" |
| 3 | تخلّص منها | في الحاوية الصحيحة، **+10** | نقاط تُضاف إليك وإلى كليتك. | Bottle flies into the plastic bin, "+10" tag |
| 4 | أبلِغ | الحاوية ممتلئة؟ **وصل البلاغ** | يرسله الوكيل إلى فريق المرافق تلقائياً. | Overflowing bin with the tag "تم إرسال البلاغ ✓" |
| 5 | للطلبة والموظفين وفريق المرافق ومكتب الاستدامة | ابدأ **بأول عبوة** | Buttons: تحدّث مع الوكيل · العب لعبة الفرز | Entrance of the main hall |

English copy is written alongside (same structure). The home page uses the public demo university's snapshot. A thin progress rail shows the current screen. Text sits at the bottom on phones and on the right (RTL) on wide screens, over a phase-aware scrim, so it is always readable.

### Agent

- Campus behind; on phones the chat is a bottom sheet (max 56 % of the height, drag or tap to expand to full height); on wide screens a floating 420 px panel.
- Top bar: logo, segmented control (الوكيل · أثري · plus البلاغات / لوحة الجامعة by role), clock button. Points chip under the bar, counting up when points are earned.
- Empty state: "مرحباً، ماذا ستتخلّص منه اليوم؟" / "التقط صورة للغرض، أو اكتب سؤالك." plus three role-specific suggestions in MSA.
- Composer: large lime camera button (primary), text field with send, voice button when supported.
- Effects on the campus from real action cards: `logged` with points → bottle flies into the plaza bin matching the card's `bin` (falls back to the first plaza bin), "+N" tag, lid opens; `report` / `audit` with a report → camera turns to the overflowing bin and shows "تم إرسال البلاغ ✓"; `resolved` → the overflowing bin returns to normal.
- The `logged` card gains a `bin` field (edge function `log_recycling`, Deno test).

### My impact, Reports, Campus dashboard

Same data and behaviour as today, restyled to the new identity: one column on phones, generous spacing, no boxed grids of more than four tiles. My impact gets the "أسبوعك على الحرم" button that plays the existing 7-day replay over the scene.

### Sorting game (Learn page)

- Camera in front of the four plaza bins: نفايات عامة، ورق وكرتون، بلاستيك، معادن (fixed set for the game, independent of the university).
- Eight rounds with real item photos from `public/items/` shown on a white card: bottle → plastic, chips bag → general, can → metal, greasy pizza box → general, used paper → paper, used tissue → general, clean cardboard → paper, banana peel → general.
- Answer by dragging the card onto a bin or tapping the bin's button (buttons are ordered left to right like the bins). The card flies into the bin, the lid opens, "+10" or "ليست هنا" shows above it, and a one-line MSA explanation appears.
- End card: "النتيجة ٧ من ٨" with "العب مرة أخرى" and "اسأل الوكيل".
- Keyboard: bins are buttons; focus is visible; the result line is announced (`role="status"`).

## Language rules (enforced)

- All Arabic strings live in `src/pages/copy.js`, `src/agent/strings.js` and `src/campus/text.js`.
- A unit test (`src/lib/__tests__/copy.test.js`) fails if any Arabic string contains a dialect word from a maintained list (وين، شو، هلق، هلأ، بدك، بدي، مليانة، مليان، كتير، هيك، لسا، منيح، الإيجنت، إيجنت) or the adjective "صح" used as "correct".
- The agent system prompt says: reply in Modern Standard Arabic when the interface is Arabic, even if the user writes in a dialect. A Deno test checks the prompt contains this rule.

## Performance and quality bar

- Initial JS ≤ 250 KB gzip (three.js and the scene stay in the lazy chunk), checked by the existing manifest e2e test.
- No horizontal scroll at 360, 390 and 1366 px in Arabic and English (e2e).
- Every phase × page × size combination is screenshotted by a review script and inspected before the PR: 4 phases × (home 5 screens, agent, game) × (390, 1366).
- `prefers-reduced-motion`: no camera drift, no sway, no grain animation, still image instead of the live scene.

## Testing

- Unit (node:test): `timeOfDay` (phase boundaries, interpolation continuity at 24 h, manual modes), `compose` (slot assignment, unnamed defaults, plaza bins from university bins, report bin), `camera` (shot interpolation), game rules (answers and score), copy dialect guard.
- SQL (PGlite): `campus_snapshot` returns `university.bins` and still no user ids.
- Deno: `log_recycling` card has `bin`; prompt MSA rule.
- e2e (Playwright, SwiftShader): home has 5 screens and the clock button changes the phase; game plays 8 rounds (right and wrong answers, end card, play again); agent logged card triggers the "+10" tag; report shows the report tag; no horizontal scroll; still image is used with reduced motion; three.js not in the initial chunk.

## Out of scope

- No new backend features beyond `campus_snapshot.university.bins` and the `bin` field on logged cards.
- No changes to points, verification, roles, invites or weekly insights.
- No paid assets; all 3D is procedural.

## Rollout

Work on branch `feature/campus-redesign`, one PR. The owner reviews the Netlify deploy preview on her phone before merging. The database migration is additive and applied before the PR is opened, then the agent function is redeployed.
