# EcoWasteAI Phase 2: Living Campus redesign (design)

Status: draft for review
Branch: `feature/living-campus`
Chosen direction: **A, Living Campus** (mockups: https://claude.ai/artifact/46LeSVJGWw8U7AWnDPxEh6)

## 1. Goal

Replace the current plain UI with a distinctive identity built around a **3D model of the user's own
campus that reacts to what the agent does**. Judges and students should see the agent working: items
flying into bins, pins appearing on buildings, trees growing around faculties that recycle well.

Success:

1. The agent screen shows the living campus with the chat as a bottom sheet over it; every agent
   action (logged item, bin report, audit) visibly changes the campus within one second of the reply.
2. A "Your week" replay animates the last 7 days of real data in about 20 seconds (usable as the demo video).
3. Any university gets its own campus generated from its `locations` rows, with no per-university design work.
4. On a mid-range phone the page is usable (text, chat, onboarding) before the 3D loads; the 3D chunk
   loads lazily and never blocks input. Low-end devices and `prefers-reduced-motion` get a static illustrated campus.
5. Free: open-source libraries only, no paid assets or services.
6. Arabic (RTL) and English, light and dark themes.

Selected ideas (from the brainstorm): 1 campus grows with recycling, 2 item flies into the bin,
3 "Eco" agent character, 6 weekly replay, 9 campus generated from data.
Not in this phase: tap-a-building detail cards beyond a simple tooltip, day/night cycle, admin heatmap
mode, share cards (candidates for Phase 3).

## 2. Visual identity

| Token | Light | Dark | Use |
|---|---|---|---|
| `--ink` | `#0b3b2c` | `#e3f4ea` | text, dark surfaces |
| `--leaf` | `#127a5c` | `#3fcf98` | primary actions, verified |
| `--lime` | `#c6f36b` | `#c6f36b` | points, highlights, the one "pop" colour |
| `--sky` | `#dff3ea` | `#0c1a14` | page background top |
| `--paper` | `#f7fbf8` | `#101f18` | page background, sheets |
| `--card` | `#ffffff` | `#15281f` | cards |
| `--amber` | `#ffb547` | `#ffc56b` | reports, warnings |
| `--muted` | `#5a6b62` | `#9db1a6` | secondary text |

Type: **Alexandria** (display: headings, numbers, buttons) and **IBM Plex Sans Arabic** (body), both
from Google Fonts with system fallbacks. Radius 18-22px on cards and sheets, pill buttons. Motion:
one signature moment per interaction (item flight, tree growth), everything else quiet; all motion
disabled under `prefers-reduced-motion`.

## 3. Architecture

```
src/
  theme/tokens.css            design tokens (light/dark), fonts, base elements
  campus/
    layout.js                 pure: locations -> building footprints/positions on a grid (deterministic)
    growth.js                 pure: faculty stats -> tree count/size, litter level
    replay.js                 pure: events of 7 days -> timeline of frames for the replay
    data.js                   fetch campus_snapshot via supabase-js
    CampusScene.jsx           react-three-fiber scene: ground, buildings, trees, litter, pins, Eco (lazy chunk)
    CampusFallback.jsx        static SVG campus (also the loading state)
    Campus.jsx                chooses scene vs fallback, owns the event queue (pins, flights)
    Eco.jsx                   the agent character + speech bubble (in-scene and 2D fallback)
  agent/                      existing logic, restyled; AgentChat becomes a bottom sheet
  pages/Home.jsx, Learn.jsx   restyled pages split out of App.jsx
```

- **3D stack:** `three`, `@react-three/fiber`, `@react-three/drei` (MIT). Buildings, trees and bins are
  generated from primitives (boxes, cylinders, cones) with flat shading; no model files. The scene is
  imported with `React.lazy`, so the first paint ships no 3D code.
- **Device gate:** use the 3D scene when WebGL2 is available, `prefers-reduced-motion` is off and
  `navigator.hardwareConcurrency >= 4` (or unknown); otherwise `CampusFallback`.
- **Events into the campus:** `AgentChat` emits the action cards it receives; `Campus` maps each card
  kind to an effect: `logged` → item flight from the chat sheet to the building at its location (or
  the faculty's building) + `+N` counter; `report`/`audit` → amber pin; `resolved` → pin removed.
- **Eco:** a small leaf character (rounded body, two eyes, a stem) that walks to the building of the
  latest action and shows the reply's first sentence in a bubble; idle bobbing otherwise.

## 4. Data

New column `universities.public_demo boolean default false` (true only for the demo university) and a
new read function (migration), callable by members of that university, or by anyone when the
university has `public_demo = true`, returning **anonymised** data, no user ids:

`campus_snapshot(p_university uuid) returns jsonb`:
- `locations`: id, name, kind, faculty, lat, lng
- `faculties`: faculty, points_30d, items_30d, correct_rate_30d, wrong_items_30d
- `events_7d`: created_at, location_id, faculty, category, correct_bin, verification, quantity (max 500, newest first)
- `open_reports`: location_id, issue, contamination_pct

Campus layout uses `lat/lng` when present (projected to a local grid and snapped to avoid overlap);
locations without coordinates are placed in a ring around the centre. Buildings are grouped by
faculty: one main building per faculty plus small kiosks for `bin_station`/`drop_off` rows.

Growth: trees per faculty = `min(12, floor(points_30d / 40))`; tree scale grows with
`correct_rate_30d`; litter piles = `min(4, floor(wrong_items_30d / 10))`.

## 5. Screens

- **Home:** full-width living campus of the demo university (read-only, no sign-in needed, via the
  `public_demo` path of `campus_snapshot`), headline, two actions ("Talk to the agent",
  "How it works"), three short value blocks (snap / log / see impact), a strip of real numbers.
- **Agent:** campus fills the screen; chat is a bottom sheet (collapsed: input + last reply; expanded:
  history); top bar with points and the "Your week" button; tabs (My impact / Reports / Campus)
  move into a compact segmented control.
- **My impact, Reports, Campus (admin), Onboarding, Learn + sorting game:** same components and data,
  restyled with the new tokens; onboarding gets the campus as a blurred backdrop.
- The old Jordan-only universities map is removed from the home page (its data stays in the repo).

## 6. Errors and fallbacks

- Snapshot fails → campus shows the static fallback with a small "offline" chip; chat still works.
- WebGL context lost → swap to fallback without reloading.
- Unknown `location_id` in an action card → effect goes to the faculty building, else the centre.
- Replay with no events → message "No activity this week yet" instead of an empty animation.

## 7. Testing

- Unit (node:test): `layout.js` (deterministic, no overlaps, handles missing coordinates, 1 and 40
  locations), `growth.js` (caps and zero data), `replay.js` (ordering, 20 s duration, empty week).
- SQL (pglite): `campus_snapshot` returns only that university, no user ids, members only; demo
  flag allows anonymous read of the demo university only.
- E2E (Playwright, mocked): home renders headline and fallback campus before 3D loads; logging an
  item triggers a flight element and a `+10`; reduced-motion shows the fallback; RTL and LTR;
  phone and desktop screenshots in light and dark for review.
- Performance check: initial JS (without the lazy 3D chunk) stays under 250 KB gzip; build reports chunk sizes.

## 8. Rollout

Work on `feature/living-campus`; migration applied to Supabase after review; website through a PR
(one Netlify deploy on merge).
