# EcoWasteAI Phase 1: Campus Sustainability Agent (design)

Status: draft for review
Branch: `feature/agent-phase1`
Target: Dubai Chamber "Create AI Agents Championship", category Best Societal AI Agent

## 1. Goal

Turn EcoWasteAI from a question-answering assistant (RAG chat + photo classifier) into an
**agent that acts on behalf of the whole university community**: students, faculty, staff,
facilities teams and the sustainability office, at **any university**, not only Jordanian ones.

Success for Phase 1:

1. In a live demo the agent visibly **takes actions on its own** (logs recycling, files bin
   reports, computes impact, analyses campus data and proposes interventions), shown to the
   user as action cards.
2. Every interaction produces **objectively recorded behaviour data**. This addresses the main
   limitation of the master's study (self-reported behaviour and self-reported agent use).
3. Everything runs on **free tiers**: Supabase Free, Gemini API free tier, Netlify Free
   (development happens locally; production deploys are rare and manual).

Out of scope for Phase 1 (Phase 2): the full visual redesign and 3D experience, gamified
3D sorting game, public marketing pages. Phase 1 UI is functional and clean, not final.

## 2. Evidence this builds on

Master's field study, March 2026: 165 valid responses, two Jordanian universities, two weeks of
use, 23-item 7-point Likert survey. All five hypotheses supported (p < .001). The
intention→behaviour path was stronger among heavier users of the agent (simple slopes
0.46 / 0.66 / 0.87 for low / medium / high use). Cross-sectional and self-reported, so the
claim is association, not causation. Phase 1 adds the instrumentation needed to measure
behaviour objectively in the next pilot.

## 3. Architecture

Chosen approach: **a single tool-calling agent loop in a Supabase Edge Function**, using Gemini
function calling. Rejected: agent frameworks such as LangGraph (need a paid always-on server, poor
fit for Deno edge functions) and browser-side orchestration (would expose keys and let users
forge actions).

```
Browser (React)  ──POST /functions/v1/agent { message, image?, conversationId }──►  Edge Function `agent`
   ▲                                                                                  │
   │  { reply, actions[], conversationId }                                            │ 1. verify user JWT, load profile + university config
   └──────────────────────────────────────────────────────────────────────────────── │ 2. load last 12 messages (memory)
                                                                                      │ 3. Gemini call with role-filtered tool list
                                                                                      │ 4. execute requested tools (max 4 steps)
                                                                                      │ 5. store messages + agent_actions, return
Postgres (RLS) ◄── tools read/write with the caller's identity ──────────────────────┘
pg_cron (weekly) ──► Edge Function `insights` ──► insights table (proactive analysis)
```

Key rules:

- Tools run **as the calling user** (their JWT is forwarded to PostgREST), so Row Level
  Security decides what each tool can see or change. The service role key is used only for the
  knowledge-base search (unchanged) and the weekly insights job.
- The tool list sent to Gemini depends on the user's role; the server re-checks the role before
  executing any tool, so a manipulated prompt cannot call a tool the role does not have.
- Maximum 4 model steps per user message, temperature 0.2. `gemini-2.5-flash` for the agent
  loop, `gemini-2.5-flash-lite` as fallback.
- The existing `chat` and `classify` functions stay deployed and untouched until the new UI
  replaces them, so the current production site keeps working.

## 4. Identity and roles

- **Quick start (anonymous sign-in)** for community members: on first visit the user picks a
  university and a role (`student`, `faculty`, `staff`) and optionally a faculty/building.
  Supabase anonymous auth gives them a stable user id, so history, points and impact persist on
  that device. Optional later upgrade to email.
- **Email + password** for `facilities` and `admin` (sustainability office). These roles can only
  be granted by redeeming a per-university invite code stored in the database (hashed); users
  cannot set them on their own profile (enforced by RLS and a check in the profile function).
- Supabase anonymous sign-ins must be enabled in the dashboard (free). CAPTCHA is recommended
  later to limit abuse.

## 5. Agent tools

Shared by every role:

| Tool | What it does |
|---|---|
| `search_knowledge(query)` | Existing RAG search over `documents`, filtered to general + the user's university |
| `classify_item(image)` | Gemini vision with **the university's own sorting rules and bins** injected into the prompt |
| `log_recycling(item, category, bin, quantity, location_id?)` | Records a recycling action, returns points and estimated impact |
| `report_bin_issue(location_id, issue, note?, photo?)` | Files a report (`full`, `contaminated`, `damaged`, `missing`) for facilities |
| `audit_bin_photo(image, location_id?)` | **Bin audit**: reads a photo of an open bin, lists visible items, estimates the contamination share and files a `contaminated` report automatically above a threshold |
| `find_drop_off(material)` | Nearest drop-off points for a material (batteries, e-waste, glass, ...) |
| `get_my_impact()` | The user's totals: items, estimated kg, estimated kg CO2e, points, streak |
| `get_leaderboard()` | Faculty/building ranking within the university |

Facilities only: `list_open_reports()`, `resolve_report(report_id, note)`.

Admin only: `get_campus_stats(period)`, `analyze_trends(period)` (top mis-sorted items, worst
locations, trend vs previous period, 3 recommended interventions), `draft_campaign(topic,
audience)` (awareness message grounded in the data).

Every executed tool is written to `agent_actions` and returned to the UI as an action card
(for example "Logged 1 plastic bottle, +10 points", "Report sent to facilities").

## 6. Proactive behaviour

A weekly pg_cron job calls the `insights` function for each active university. It computes the
same statistics as `analyze_trends`, asks Gemini for a short report with three recommended
actions, and stores it in `insights`. Admins see it on their dashboard and can ask the agent
follow-up questions about it.

## 7. Data model (new migration)

| Table | Key columns |
|---|---|
| `universities` | id, name, country, default_language, bins (jsonb: id, label_ar, label_en, color, accepts), sorting_rules (text), points_per_item, active |
| `locations` | id, university_id, name, kind (`building`, `bin_station`, `drop_off`), materials[], lat, lng |
| `profiles` | user_id (auth.users), university_id, role, faculty, display_name, created_at |
| `role_invites` | university_id, role, code_hash, uses_left, expires_at |
| `recycling_events` | id, user_id, university_id, location_id, item, category, bin, recyclable, quantity, est_kg, est_co2e_kg, points, source (`photo`, `chat`, `game`), created_at |
| `bin_reports` | id, university_id, location_id, reporter_id, issue, note, contamination_pct, status (`open`, `resolved`), resolved_by, created_at, resolved_at |
| `conversations` / `messages` | agent memory, per user |
| `agent_actions` | id, user_id, conversation_id, tool, input (jsonb), result (jsonb), ok, created_at |
| `insights` | id, university_id, period_start, period_end, stats (jsonb), report, created_at |
| `impact_factors` | category, avg_item_kg, co2e_saved_per_kg, source_note |

`documents` gets a nullable `university_id` (null = general knowledge). Existing rows stay
general. `match_documents` is called with a filter so a university only sees general rows and
its own rows.

**RLS summary:** members read/write only their own rows; facilities read and resolve reports
of their university; admins read aggregated views of their university (`university_stats`
view, no raw personal rows of other users beyond what reports need); nobody reads another
university's data. Writes that award points go through tools (server-side), not direct inserts
from the browser.

**Impact numbers** are estimates from `impact_factors` (average item weight × emission factor
per material). The UI and pitch label them as estimates and cite the factor source.

## 8. Multi-university

- One seeded **demo university** with realistic demo data for the pitch and video.
- The two pilot universities can be added as configured tenants.
- Adding a university = inserting a `universities` row, its `locations`, invite codes and
  optional university-specific documents. No code change.
- UI and agent replies in Arabic and English (existing behaviour kept).

## 9. Phase 1 UI (functional)

- Onboarding: choose university → choose role → start.
- Agent chat: text, photo, action cards, conversation history from the server.
- "My impact" page: totals, streak, faculty ranking.
- Facilities page: open reports, resolve.
- Admin page: key numbers, latest weekly insight, "ask the agent about my campus".
- Voice input using the browser's free Web Speech API where supported (Arabic and English);
  hidden when unsupported.

## 10. Errors and limits

- Gemini 429 or timeout → one fallback model, then a friendly message; no partial writes
  (a tool's database write happens only after its arguments validate).
- Tool argument validation on the server (enums, lengths, ownership of `location_id`).
- Rate limits: existing per-IP limiter plus a per-user cap (for example 30 agent messages per
  10 minutes) to stay inside the free Gemini quota.
- If the user is not signed in or has no profile, the function returns `needs_onboarding`.

## 11. Testing

- Deno unit tests for every tool with mocked fetch (argument validation, role checks, points
  and impact maths, contamination threshold).
- Agent loop test with a scripted fake Gemini (multi-step tool calls, step cap, unknown tool,
  forbidden tool for role).
- SQL tests for RLS (user A cannot read user B; admin of university X cannot read Y; a member
  cannot set their role to admin).
- The old test "no code writes to the database" is replaced by tests that check writes happen
  only through the agent tools and RLS.
- `npm run build` and `npm run lint` pass.

## 12. Rollout without spending money

1. All work on `feature/agent-phase1`, tested locally with `npm run dev`.
2. Migration applied to the Supabase project only after the owner approves it.
3. Netlify auto-deploys turned off; one manual production deploy when Phase 1 is accepted.
4. Before judging, make sure the Supabase project is active (free projects pause after a week
   without activity).
