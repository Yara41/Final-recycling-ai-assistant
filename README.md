# EcoWasteAI — campus sustainability agent

React/Vite website (Arabic RTL + English) hosted on Netlify as a static site, with an AI **agent**
for the whole university community (students, faculty, staff, facilities, sustainability office),
for any university.

- **Agent** (`supabase/functions/agent`): Gemini function-calling loop (max 4 steps) over role-based
  tools: classify a photo with the university's own bins, log recycling with points, report or audit
  bins from a photo, find drop-off points, personal impact, faculty ranking, campus statistics,
  trend analysis and data-grounded campaigns.
- **Weekly insights** (`supabase/functions/insights`): pg_cron asks the agent to analyse each
  university's week and propose 3 interventions.
- **Database** (`supabase/migrations`): multi-university tenants, roles with invite codes, recorded
  recycling behaviour, bin reports, agent memory and an audit trail of agent actions, all behind
  Row Level Security. Points can only be written by the agent (service role), never by the browser.
- **Living Campus** (`src/campus`): each university is drawn as a 3D campus generated from its own
  data (`campus_snapshot`): one building per faculty, trees that grow with verified points, litter where
  sorting goes wrong, pins on reported bins, and Eco, the agent's character. Agent actions animate it
  (items fly into their building, reports pin the bin) and "Your week" replays the last 7 days.
  three.js is lazy-loaded; low-end or reduced-motion devices get an illustrated SVG version
  (`?3d=1` / `?3d=0` force either).
- **Website** (`src/pages`, `src/agent`): landing page with the live demo campus, onboarding, the agent
  chat as a sheet over the campus (photo and voice input, action cards), My impact, facilities reports
  and the campus dashboard.

Setup, in Arabic, step by step and free: **[docs/AGENT_SETUP.md](docs/AGENT_SETUP.md)**.
Design and plan: `docs/superpowers/specs/` and `docs/superpowers/plans/`.
The legacy `chat` and `classify` functions are documented in [docs/SUPABASE_MIGRATION.md](docs/SUPABASE_MIGRATION.md).

Supabase project: **`uwxksbwlzjrjlccbdjtk`** (`https://uwxksbwlzjrjlccbdjtk.supabase.co`, ap-south-1). The build refuses any other project.

Local development: copy `.env.example` to `.env.local`, fill in the two public values, then `npm install && npm run dev`.

Tests: `npm run test:sql` (database + RLS, in-memory Postgres), `npm run test:functions` (Edge Functions),
`npm run test:web` (website helpers), `npm run build && npm run test:e2e` (browser).

---

# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
