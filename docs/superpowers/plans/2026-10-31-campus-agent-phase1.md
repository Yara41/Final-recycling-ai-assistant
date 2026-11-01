# Campus Sustainability Agent (Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the RAG chat with a role-aware, multi-university, tool-calling agent that records real recycling behaviour, files and resolves bin reports, audits bins from photos and writes weekly insights.

**Architecture:** One Supabase Edge Function `agent` runs a Gemini function-calling loop (max 4 steps) over a role-filtered tool registry. Reads run with the caller's JWT under RLS; writes that award points or create reports go through `SECURITY DEFINER` SQL functions executable only by `service_role`, called by the edge function with the verified user id. A second function `insights` is triggered weekly by pg_cron. The React app gains anonymous onboarding, an agent chat with action cards, and impact / facilities / admin pages.

**Tech Stack:** React 19 + Vite 7, `@supabase/supabase-js` v2, Supabase Postgres (RLS, pgvector, pg_cron, pg_net), Deno Edge Functions, Gemini REST API (`gemini-2.5-flash`, fallback `gemini-2.5-flash-lite`, `gemini-embedding-001` 3072-d). Tests: Deno test (functions), Node `node:test` + `@electric-sql/pglite` (SQL/RLS), Vitest (frontend libs), Playwright (smoke).

**Spec:** `docs/superpowers/specs/2026-10-31-campus-agent-phase1-design.md`

## Global Constraints

- Free tiers only. No paid services, no always-on server.
- Supabase project ref stays `uwxksbwlzjrjlccbdjtk`; every pinned place keeps matching (existing ref test).
- Agent loop: max **4** model steps per message, temperature **0.2**, models `gemini-2.5-flash` then `gemini-2.5-flash-lite`.
- Memory: last **12** messages of the conversation are sent to the model.
- Per-user cap: **30** agent messages per **10** minutes (in addition to the existing per-IP guard).
- Self-service roles are only `student`, `faculty`, `staff`. `facilities` and `admin` come only from an invite code.
- Auto contamination report threshold: **25%**; no duplicate `contaminated` report for the same location within **24 h**.
- Points: `universities.points_per_item` (default **10**) × quantity when the chosen bin is the correct bin; otherwise **0**. Quantity 1–50.
- Impact numbers are estimates and always labelled as such.
- Replies in the user's language (Arabic or English). UI stays bilingual and RTL-aware.
- The old `chat` and `classify` functions and the current UI flow keep working until Task 9 switches the assistant page.
- Nothing is applied to the live Supabase project or deployed to Netlify without the owner's explicit approval.
- Commit messages end with the session attribution lines.

## Refinement of the spec (decided while planning)

Spec section 3 says tools run as the calling user. To stop users forging points by calling PostgREST directly with their own JWT, **writes** (`log_recycling_event`, `file_bin_report`, `resolve_bin_report`, `save_agent_turn`, `save_insight`) are `SECURITY DEFINER` functions granted to `service_role` only; the edge function passes the user id it verified from the JWT. **Reads** still use the caller's JWT under RLS. Task 1 updates the spec sentence.

## Review Focus

1. A user writes in Arabic dialect or mixes Arabic and English → the reply and action-card text follow the UI language (`lang`), not a random one. Test in Task 4.
2. Gemini calls a tool with missing/invalid arguments or a `location_id` belonging to another university → the tool returns `{ ok:false, error }` to the model, nothing is written. Tests in Task 3.
3. Gemini fails (429/timeout) after a tool already wrote in the same turn → the response still returns the completed action cards and a fallback reply; the write is not repeated. Test in Task 4.
4. The browser lost its anonymous session or the user never onboarded → the API answers `needs_onboarding` and the UI shows onboarding instead of an error. Tests in Tasks 5 and 8.
5. Large phone photos (HEIC, > 4 MB) → resized client-side to ≤1024 px JPEG before upload; server rejects oversize with `too_large`. Tests in Tasks 3 and 8.

---

## File Structure

```
supabase/
  migrations/20261031120000_campus_agent.sql      schema, RLS, SQL functions
  migrations/20261031120100_weekly_insights_cron.sql  pg_cron job (applied last, manually)
  seed/demo_university.sql                        demo tenant + locations + demo events
  functions/_shared/supabase.ts                   REST helpers: getUser, restGet (user JWT), serviceRpc
  functions/_shared/gemini.ts                     embed(), generate() with tools + fallback
  functions/agent/types.ts                        Role, University, ToolContext, ToolResult, ActionCard
  functions/agent/tools/*.ts                      one file per tool
  functions/agent/tools/index.ts                  registry, toolsForRole(), runTool()
  functions/agent/prompt.ts                       buildSystemPrompt(ctx)
  functions/agent/loop.ts                         runAgent()
  functions/agent/handler.ts, index.ts            HTTP entry
  functions/insights/handler.ts, index.ts         weekly job
  functions/tests/agent_*.test.ts                 Deno tests
tests/sql/*.test.mjs                              pglite RLS + SQL function tests
src/lib/supabase.js, session.js, agent.js, image.js   frontend data layer
src/agent/*.jsx                                   Onboarding, AgentChat, ActionCard, VoiceButton,
                                                  ImpactPage, FacilitiesPage, AdminPage
docs/AGENT_SETUP.md                               owner's step-by-step setup (free)
```

---

### Task 1: Database schema, RLS and SQL functions

**Files:**
- Create: `supabase/migrations/20261031120000_campus_agent.sql`, `supabase/seed/demo_university.sql`
- Create: `tests/sql/helpers.mjs`, `tests/sql/rls.test.mjs`, `tests/sql/functions.test.mjs`
- Modify: `supabase/functions/tests/functions.test.ts` (delete test "no code in this repo writes to the database"; replace with "browser code never uses the service role" asserting `src/**` has no `service_role`/`sb_secret_`)
- Modify: `package.json` (devDeps `@electric-sql/pglite`, `deno`; script `"test:sql": "node --test tests/sql/"`; `test:functions` uses `npx deno`)
- Modify: spec section 3, sentence on tools/identity, per "Refinement" above

**Interfaces:**
- Produces tables exactly as spec section 7, plus enums `user_role ('student','faculty','staff','facilities','admin')`, `bin_issue ('full','contaminated','damaged','missing')`, `event_source ('photo','chat','game')`.
- `universities.bins` jsonb: `[{ "id": "plastic", "label_ar": "...", "label_en": "...", "color": "#hex", "accepts": ["plastic"] }]` (`accepts` lists categories from `plastic|paper|metal|glass|organic|hazardous|general`).
- Authenticated-callable: `create_profile(p_university uuid, p_role user_role, p_faculty text, p_display_name text) returns profiles` (rejects `facilities`/`admin` with `insufficient_privilege`; one profile per user), `redeem_invite(p_code text) returns profiles` (sha256 match, `uses_left > 0`, not expired, same university, decrements uses).
- service_role-only: `log_recycling_event(p_user uuid, p_item text, p_category text, p_bin text, p_quantity int, p_location uuid, p_source event_source) returns jsonb {event_id, correct_bin, points, est_kg, est_co2e_kg}`; `file_bin_report(p_user uuid, p_location uuid, p_issue bin_issue, p_note text, p_contamination_pct numeric) returns jsonb {report_id, duplicate boolean}`; `resolve_bin_report(p_user uuid, p_report uuid, p_note text) returns jsonb`; `save_agent_turn(p_user uuid, p_conversation uuid, p_user_text text, p_reply text, p_actions jsonb) returns uuid` (creates conversation when null); `save_insight(p_university uuid, p_start date, p_end date, p_stats jsonb, p_report text) returns uuid`.
- Read helpers (security invoker, RLS applies): view `my_impact` (per current user: items, est_kg, est_co2e_kg, points, streak_days), `faculty_leaderboard(p_university uuid)`, `university_stats(p_university uuid, p_from timestamptz, p_to timestamptz) returns jsonb` (admin only: totals, by_category, top_missorted items, worst_locations, open_reports, previous-period totals).
- `match_documents_scoped(query_embedding vector(3072), match_count int, p_university uuid)` returning `(content text, similarity float)` from `documents` where `university_id is null or university_id = p_university`. Migration adds nullable `documents.university_id` with `alter table if exists ... add column if not exists`.
- `impact_factors` seed (estimates, source_note "Approximation from US EPA WARM recycling factors; verify before publishing"): plastic 0.025 kg/item, 1.0 kg CO2e/kg; paper 0.05, 3.0; metal 0.015, 9.0; glass 0.30, 0.3; organic 0.10, 0.2; hazardous 0.05, 0; general 0.05, 0.

- [ ] **Step 1: Install test tooling** — `npm i -D @electric-sql/pglite deno`; add scripts. Run `npx deno --version` → prints a version.
- [ ] **Step 2: Write `tests/sql/helpers.mjs`** — `async function freshDb(): Promise<PGlite>` loading pglite with `vector` extension, a stub `auth` schema (`auth.users(id uuid)`, `auth.uid()` reading `current_setting('request.jwt.claim.sub', true)::uuid`), roles `anon`, `authenticated`, `service_role`, a stub `documents(id bigserial, content text, embedding vector(3072))`, then the migration and seed; `asUser(db, uuid, fn)` sets role `authenticated` + claim; `asService(db, fn)`.
- [ ] **Step 3: Write failing RLS tests** in `rls.test.mjs`:
  - `member reads only own recycling_events` (user A sees 1 row, user B's row invisible)
  - `admin of university X cannot read university Y stats` (`university_stats` raises / returns null for Y)
  - `member cannot self-assign admin` (`create_profile(...,'admin',...)` throws; direct `update profiles set role='admin'` affects 0 rows)
  - `authenticated cannot call log_recycling_event` (permission denied)
  - `facilities sees open reports of own university only`
- [ ] **Step 4: Write failing function tests** in `functions.test.mjs`:
  - `correct bin awards points_per_item × quantity` (plastic bottle in `plastic` bin, qty 3 → points 30, est_kg 0.075, est_co2e_kg 0.075)
  - `wrong bin awards 0 and correct_bin=false`
  - `quantity outside 1..50 is rejected`
  - `location of another university is rejected` (raises `invalid_location`)
  - `second contaminated report for same location within 24h returns duplicate=true and no new row`
  - `redeem_invite grants facilities and decrements uses_left; expired code fails`
  - `match_documents_scoped returns general + own-university rows only`
- [ ] **Step 5: Run** `npm run test:sql` → all FAIL (migration missing).
- [ ] **Step 6: Write the migration and seed** to satisfy the interfaces. Demo seed: university "EcoWaste Demo University" (country `AE`, bilingual), 4 bins (general, plastic, paper, metal) + glass drop-off, 8 locations across 4 faculties (Engineering, Business, Medicine, Arts) incl. one battery/e-waste drop-off, invite codes `DEMO-FACILITIES` and `DEMO-ADMIN` (hashed), 6 demo users and ~120 events over 3 weeks with Engineering showing many chips bags in the plastic bin (so the demo insight has a story).
- [ ] **Step 7: Run** `npm run test:sql` → PASS. Run `npm run test:functions` → PASS (old write-ban test replaced).
- [ ] **Step 8: Commit** `feat(db): campus agent schema, RLS and SQL functions`.

### Task 2: Shared Supabase and Gemini helpers

**Files:**
- Create: `supabase/functions/_shared/supabase.ts`, `supabase/functions/_shared/gemini.ts`
- Modify: `supabase/functions/chat/handler.ts` (use `embed()` from gemini.ts; behaviour unchanged)
- Test: `supabase/functions/tests/agent_shared.test.ts`

**Interfaces:**
- `getUser(jwt: string): Promise<{ id: string; isAnonymous: boolean } | null>` — `GET {SUPABASE_URL}/auth/v1/user` with `apikey` = `SUPABASE_ANON_KEY`, Bearer jwt; null on 401.
- `restGet<T>(jwt: string, path: string): Promise<T>` and `rpcAsUser<T>(jwt, fn, args)` — PostgREST with user JWT.
- `serviceRpc<T>(fn: string, args: Record<string, unknown>): Promise<T>` — service role; throws `HttpError(502,'db_failed')`, but maps Postgres error messages `invalid_location`, `invalid_quantity`, `insufficient_privilege` to `HttpError(400, <same code>)`.
- `embed(text: string): Promise<number[]>` (moved from chat).
- `generate(req: { system: string; contents: GeminiContent[]; tools?: FunctionDeclaration[]; json?: boolean }): Promise<{ parts: GeminiPart[]; model: string }>` — tries models in order; 401/403 stop; 429/5xx/timeout try next; final failure `HttpError(503,'model_unavailable')`. Disables thinking for 2.5 Flash models as chat does today.

- [ ] **Step 1: Failing tests:** `getUser returns null on 401`, `serviceRpc maps invalid_location to 400`, `generate falls back from flash to flash-lite on 429`, `generate stops on 403`, `generate sends tools as functionDeclarations`.
- [ ] **Step 2: Run** `npm run test:functions` → new tests FAIL.
- [ ] **Step 3: Implement both files; switch chat to `embed()`.**
- [ ] **Step 4: Run** `npm run test:functions` → all PASS (existing chat tests included).
- [ ] **Step 5: Commit** `feat(functions): shared supabase and gemini helpers`.

### Task 3: Agent tools and registry

**Files:**
- Create: `supabase/functions/agent/types.ts`, `supabase/functions/agent/tools/{search_knowledge,classify_item,log_recycling,report_bin_issue,audit_bin_photo,find_drop_off,get_my_impact,get_leaderboard,list_open_reports,resolve_report,get_campus_stats,analyze_trends,draft_campaign}.ts`, `supabase/functions/agent/tools/index.ts`
- Test: `supabase/functions/tests/agent_tools.test.ts`

**Interfaces:**
```ts
export type Role = "student" | "faculty" | "staff" | "facilities" | "admin";
export type University = { id: string; name: string; country: string; bins: Bin[]; sorting_rules: string; points_per_item: number };
export type ToolContext = { userId: string; role: Role; jwt: string; lang: "ar" | "en"; university: University;
  conversationId: string | null; image?: { data: string; mimeType: string } };
export type ActionCard = { kind: "classified" | "logged" | "report" | "audit" | "dropoff" | "impact" | "leaderboard"
  | "reports" | "resolved" | "stats" | "insight" | "campaign" | "knowledge"; title: string; detail?: string; points?: number; data?: unknown };
export type ToolResult = { ok: boolean; data?: unknown; card?: ActionCard; error?: string };
export type Tool = { name: string; roles: Role[]; declaration: FunctionDeclaration; run(args: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> };
```
- `toolsForRole(role: Role): Tool[]`; `runTool(name: string, args, ctx): Promise<ToolResult>` — unknown tool or role not allowed → `{ ok:false, error:"tool_not_allowed" }` without calling `run`.
- Members (`student|faculty|staff`) get the 8 shared tools; `facilities` = shared + `list_open_reports`, `resolve_report`; `admin` = shared + `get_campus_stats`, `analyze_trends`, `draft_campaign`.
- `classify_item` and `audit_bin_photo` use `ctx.image`; if absent → `{ok:false,error:"no_image"}`. Both inject `university.bins` and `sorting_rules` into the vision prompt and reuse `normalize()` from `classify/handler.ts`. `audit_bin_photo` JSON schema: `{ items: [{ name, category, belongs: boolean }], contamination_pct: number, summary: string }`; when `contamination_pct >= 25` and a `location_id` is given it calls `file_bin_report` with issue `contaminated`.
- `search_knowledge(query)` = `embed()` + `serviceRpc("match_documents_scoped", { query_embedding, match_count: 30, p_university: ctx.university.id })` + chat's `buildContext()`; returns passages to the model (card `knowledge` only when passages were found).
- `analyze_trends` returns stats from `university_stats` plus a short Gemini analysis with exactly 3 recommendations; `draft_campaign(topic, audience)` grounds text in the same stats.
- Card titles are built in `ctx.lang`.

- [ ] **Step 1: Failing tests (fake fetch):**
  - `student does not get admin tools` (names of `toolsForRole("student")` exclude `get_campus_stats`)
  - `runTool refuses a tool outside the role` (no fetch call made)
  - `log_recycling validates category and quantity before any DB call` (category `"wood"` → ok:false, 0 calls)
  - `log_recycling returns logged card with points from serviceRpc`
  - `log_recycling surfaces invalid_location as ok:false` (Review Focus 2)
  - `audit_bin_photo files a report at 25% and not at 24%`
  - `audit_bin_photo without image returns no_image`
  - `classify_item prompt contains the university's bin labels`
  - `cards are English when lang=en`
  - `classify_item rejects image over 4,000,000 base64 chars with too_large` (Review Focus 5)
- [ ] **Step 2: Run** `npm run test:functions` → FAIL.
- [ ] **Step 3: Implement types, tools, registry.**
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(agent): role-aware tool registry`.

### Task 4: Agent loop

**Files:**
- Create: `supabase/functions/agent/prompt.ts`, `supabase/functions/agent/loop.ts`
- Test: `supabase/functions/tests/agent_loop.test.ts`

**Interfaces:**
- `buildSystemPrompt(ctx: ToolContext): string` — persona "EcoWasteAI, the campus sustainability agent of {university.name}", the role, bins and sorting rules, "act with tools rather than only advising when the user describes an action", "reply only in {Arabic|English}", "never invent numbers; use tool results", knowledge answers only from `search_knowledge`.
- `runAgent(input: { ctx: ToolContext; history: GeminiContent[]; message: string; hasImage: boolean }, deps = { generate, runTool }): Promise<{ reply: string; actions: ActionCard[] }>` — loop up to 4 model calls; execute every `functionCall` part via `runTool`, append `functionResponse`; collect cards from ok results; stop on a text-only answer. When the 4th call still asks for tools, return the cards plus a short summary reply. When `generate` throws after ≥1 tool ran, return the cards plus a fixed fallback reply in `ctx.lang` (no rethrow, no repeat of tools). When it throws before any tool, rethrow.
- When `hasImage` is true the user message text is prefixed with an instruction that a photo is attached (so the model calls `classify_item` or `audit_bin_photo`).

- [ ] **Step 1: Failing tests (scripted fake `generate`):**
  - `two-step: classify then log returns two cards and final text`
  - `stops after 4 model calls`
  - `forbidden tool call becomes functionResponse error and loop continues`
  - `model failure after a write returns cards and fallback reply, tool ran once` (Review Focus 3)
  - `system prompt fixes reply language to lang` (Arabic message + lang=en → prompt says English) (Review Focus 1)
  - `history is passed before the new message`
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(agent): function-calling loop`.

### Task 5: `agent` HTTP function

**Files:**
- Create: `supabase/functions/agent/handler.ts`, `supabase/functions/agent/index.ts`
- Modify: `supabase/config.toml` (`[functions.agent] verify_jwt = true`, `[functions.insights] verify_jwt = false`), `package.json` `supabase:deploy` (add agent and insights; update the ref test to expect 4 occurrences)
- Test: `supabase/functions/tests/agent_handler.test.ts`

**Interfaces:**
- Request `{ message: string (≤1000 chars), image?: string (base64), mimeType?: string, conversationId?: string | null, lang: "ar"|"en" }`, header `Authorization: Bearer <user access token>`.
- Response 200 `{ reply: string, actions: ActionCard[], conversationId: string }`. Errors `{ error, code }`: 401 `unauthorized`, 409 `needs_onboarding`, 429 `rate_limited`, 400 `missing_message`/`bad_image`, 413 `too_large`, 503 `model_unavailable`.
- Flow: `guard` (perMinute 20, maxBodyChars 4,002,000) → `getUser` → profile + university via `restGet` → per-user `rateLimit("agent-user:"+id, 30, 600_000)` → last 12 messages of `conversationId` (must belong to user) → `runAgent` → `serviceRpc("save_agent_turn")` (also writes `agent_actions`) → respond.

- [ ] **Step 1: Failing tests:** `no token → 401`, `user without profile → 409 needs_onboarding` (Review Focus 4), `31st message in 10 minutes → 429`, `foreign conversationId is ignored and a new one is created`, `happy path saves the turn and returns conversationId`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(agent): HTTP endpoint with auth, memory and per-user limit`.

### Task 6: Weekly insights function and cron

**Files:**
- Create: `supabase/functions/insights/handler.ts`, `supabase/functions/insights/index.ts`, `supabase/migrations/20261031120100_weekly_insights_cron.sql`
- Test: `supabase/functions/tests/insights.test.ts`

**Interfaces:**
- `POST /functions/v1/insights` with header `x-cron-secret` equal to secret `CRON_SECRET`; otherwise 401. Body optional `{ universityId?: string }`. For each active university: `university_stats` for the last 7 days (service role) → Gemini report (lang = university `default_language`, exactly 3 recommendations) → `save_insight`. Response `{ created: number }`.
- Cron migration: `cron.schedule('ecowaste-weekly-insights', '17 6 * * 1', ...)` calling the function with `net.http_post`, reading URL and secret from Vault secrets `insights_url`, `cron_secret` (owner creates them; documented in Task 10). The file is applied after functions are deployed.

- [ ] **Step 1: Failing tests:** `missing or wrong secret → 401`, `creates one insight per active university`, `university with zero events still gets an insight saying there is no data yet` (no Gemini call).
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(insights): weekly proactive analysis`.

### Task 7: Frontend data layer

**Files:**
- Create: `src/lib/supabase.js`, `src/lib/session.js`, `src/lib/agent.js`, `src/lib/image.js`
- Modify: `package.json` (dep `@supabase/supabase-js`, devDeps `vitest`, `jsdom`; script `"test:web": "vitest run"`)
- Test: `src/lib/__tests__/session.test.js`, `agent.test.js`, `image.test.js`

**Interfaces:**
- `supabase` — single client from `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`, `persistSession: true`.
- `ensureSession(): Promise<Session>` (existing session or `signInAnonymously()`); `getProfile(): Promise<Profile|null>`; `listUniversities(): Promise<{id,name,country}[]>`; `createProfile({universityId, role, faculty, displayName})`; `redeemInvite(code)`; `signInStaff(email, password)`; `signOut()`.
- `sendAgentMessage({ message, image?, conversationId, lang }): Promise<{reply, actions, conversationId}>` — throws `ApiError` (reuse class from `api.js`) with `code` from the server, including `needs_onboarding`.
- `prepareImage(file: File): Promise<{ data: string; mimeType: "image/jpeg" }>` — longest side ≤1024 px, JPEG quality 0.82 (moved from App.jsx's existing resize logic).

- [ ] **Step 1: Failing tests:** `ensureSession signs in anonymously only when no session`, `sendAgentMessage maps 409 to code needs_onboarding`, `createProfile passes role through and surfaces insufficient_privilege`, `prepareImage scales 4000x3000 to 1024x768`.
- [ ] **Step 2: Run** `npm run test:web` → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(web): supabase session and agent client`.

### Task 8: Agent UI (onboarding, chat, action cards, voice)

**Files:**
- Create: `src/agent/Onboarding.jsx`, `src/agent/AgentChat.jsx`, `src/agent/ActionCard.jsx`, `src/agent/VoiceButton.jsx`, `src/agent/agent.css`, `src/agent/strings.js` (ar/en copy)
- Modify: `src/App.jsx` (assistant page renders `<AgentChat>` behind `<Onboarding>` gate; remove `callFunction('chat'|'classify')` usage and localStorage conversations)
- Test: `tests/e2e/agent.spec.mjs` (Playwright, network mocked with `page.route`), `src/agent/__tests__/ActionCard.test.jsx`

**Interfaces:**
- `<Onboarding onDone={(profile) => void} lang>`: step 1 university list, step 2 role (student/faculty/staff) + optional faculty, link "I have a staff code" → invite code field (staff sign-in with email for facilities/admin).
- `<AgentChat profile lang>`: message list from server conversation; text box; photo button (uses `prepareImage`); `VoiceButton` (Web Speech API, `ar-JO`/`en-US`; renders nothing if `window.SpeechRecognition ?? window.webkitSpeechRecognition` is undefined); renders `actions` as `<ActionCard card lang>` above the reply; on `needs_onboarding` re-shows onboarding.
- `<ActionCard>` icon + colour per `kind`, title, detail, `+N` points badge.

- [ ] **Step 1: Failing tests:** `ActionCard renders points badge only when points>0`; Playwright: `first visit shows onboarding then chat`, `sending "رميت قنينة بلاستيك" shows a logged card` (mock agent response), `needs_onboarding response returns to onboarding` (Review Focus 4), `voice button hidden when SpeechRecognition missing`.
- [ ] **Step 2: Run** `npm run test:web` and `npx playwright test tests/e2e` (against `npm run build && npm run preview`) → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** both → PASS; `npm run lint` and `npm run build` → no errors.
- [ ] **Step 5: Commit** `feat(web): agent chat with onboarding, action cards and voice`.

### Task 9: Impact, facilities and admin pages

**Files:**
- Create: `src/agent/ImpactPage.jsx`, `src/agent/FacilitiesPage.jsx`, `src/agent/AdminPage.jsx`
- Modify: `src/App.jsx` (nav entries shown by role: everyone "My impact"; facilities "Reports"; admin "Campus")
- Test: extend `tests/e2e/agent.spec.mjs`

**Interfaces:**
- ImpactPage reads `my_impact` and `faculty_leaderboard` via supabase-js; shows "estimate" label next to kg and CO2e.
- FacilitiesPage lists open `bin_reports` (newest first, contamination % badge) with "Resolve" → `sendAgentMessage({message:"resolve report <id>"})` so the action goes through the agent and is logged.
- AdminPage shows `university_stats` for 7/30 days, the latest `insights` row, and an "Ask about my campus" box using `AgentChat` in place.

- [ ] **Step 1: Failing Playwright tests (mocked):** `student sees My impact but not Campus`, `admin sees latest insight text`, `facilities resolve sends a message and removes the row`, `impact shows the word estimate/تقديري`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS; lint + build clean.
- [ ] **Step 5: Commit** `feat(web): impact, facilities and admin pages`.

### Task 10: Setup guide and final verification

**Files:**
- Create: `docs/AGENT_SETUP.md` (owner's free setup, in Arabic with English commands)
- Modify: `README.md` (short architecture summary + link), `docs/SUPABASE_MIGRATION.md` (note it describes the legacy functions)

Guide covers, in order: enable Anonymous sign-ins (Authentication → Sign In / Providers); inspect the live `documents` columns and confirm they match `content`/`embedding` before applying the migration; apply migrations + seed; set secrets `SUPABASE_ANON_KEY` (if not auto-provided), `CRON_SECRET`; deploy functions with `npm run supabase:deploy`; create Vault secrets and apply the cron migration; stop Netlify auto-builds and deploy manually with the CLI; keep the project active before judging; Gemini free-tier limits.

- [ ] **Step 1: Write the guide and README changes.**
- [ ] **Step 2: Run full verification:** `npm run test:sql`, `npm run test:functions`, `npm run test:web`, `npm run lint`, `npm run build`, Playwright suite → all pass; record output in the PR description.
- [ ] **Step 3: Commit and push** `docs: agent setup guide`; push `feature/agent-phase1`.
