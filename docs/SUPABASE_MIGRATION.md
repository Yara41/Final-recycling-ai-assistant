# EcoWasteAI: AI backend on Supabase Edge Functions

Netlify now hosts only the static React/Vite build (`dist/`). All AI processing runs in
two Supabase Edge Functions that call Google Gemini:

| Function   | Path                                   | Does                                                                 |
|------------|----------------------------------------|----------------------------------------------------------------------|
| `chat`     | `supabase/functions/chat/handler.ts`   | Gemini embedding (3072) → `match_documents` (read only) → Gemini answer |
| `classify` | `supabase/functions/classify/handler.ts` | Gemini vision → `{ is_waste, item, category, recyclable, tip, confidence }` |

Shared safeguards are in `supabase/functions/_shared/security.ts`.

## 0. Target Supabase project (do not change)

| | |
|---|---|
| Project ref | `uwxksbwlzjrjlccbdjtk` |
| URL | `https://uwxksbwlzjrjlccbdjtk.supabase.co` |
| Region | ap-south-1 (Mumbai) |
| Dashboard name | "yarahyari41@gmail.com's Project" (renaming it to "EcoWasteAI" in Project Settings → General is safe; the ref and URL do not change) |
| Contents used | table `documents` (817 rows, 3072-dim embeddings), SQL function `match_documents`, Edge Functions `chat` and `classify` |

The ref is pinned in four places, and a Deno test fails if they ever differ:

- `vite.config.js` → `EXPECTED_SUPABASE_REF`: the build and the dev server stop if `VITE_SUPABASE_URL`
  or the `ref` inside `VITE_SUPABASE_ANON_KEY` belongs to another project.
- `supabase/functions/_shared/security.ts` → `EXPECTED_PROJECT_REF`: `chat` refuses to search
  (HTTP 500, code `wrong_project`) if it is deployed to any other project.
- `supabase/config.toml` → `project_id`.
- `package.json` → `npm run supabase:deploy` passes `--project-ref uwxksbwlzjrjlccbdjtk` explicitly.

### Database safety

- `match_documents` is a plain `SELECT ... ORDER BY embedding <=> query_embedding LIMIT n`; it reads only.
- This branch contains **no migrations and no SQL**. The only database call is `POST /rest/v1/rpc/match_documents`.
- A Deno test ("no code in this repo writes to the database") fails if a write method, a table write,
  another REST endpoint or a `supabase/migrations` folder is added.

## 1. Secrets (Supabase → Edge Functions → Secrets)

| Name | Required | Notes |
|------|----------|-------|
| `GEMINI_API_KEY` | yes (already set) | Used only inside the functions. |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | provided automatically | The service role key is needed because `documents` has RLS on with no public policy. It never reaches the browser. |
| `ALLOWED_ORIGINS` | only for a custom domain | Comma separated, e.g. `https://ecowaste.example.jo`. The Netlify site `recycling-ai-assistant2026.netlify.app`, its deploy previews and `localhost:5173/4173` are allowed by default. |
| `GEMINI_CHAT_MODEL` | optional | Default `gemini-2.5-flash` (fallback `gemini-2.5-flash-lite`). |
| `GEMINI_VISION_MODEL` | optional | Default `gemini-flash-latest` (fallback `gemini-2.5-flash`). |
| `MIN_SIMILARITY` | optional | 0 = off. If set (e.g. `0.6`), questions below it get the fixed "no information" reply without calling Gemini. |

CLI equivalent: `supabase secrets set --project-ref uwxksbwlzjrjlccbdjtk ALLOWED_ORIGINS="https://..."` (never commit secrets).

## 2. Netlify environment variables (public values only)

Site configuration → Environment variables, scope **Builds**, all deploy contexts:

- `VITE_SUPABASE_URL` = `https://uwxksbwlzjrjlccbdjtk.supabase.co`
- `VITE_SUPABASE_ANON_KEY` = the **legacy anon** key of the same project (Supabase → Project Settings → API Keys → Legacy API keys → `anon`, `public`)

Do not mark them as "contains secret values": they are public by design and are in the built JS.
`netlify.toml` tells secret scanning to skip them.

`vite.config.js` stops the build if a service_role key, a `sb_secret_` key, a Gemini/Groq key, or a
`sb_publishable_` key is placed in a `VITE_` variable, or if the two variables are missing in production.

After the new site is live and tested, delete `SUPABASE_KEY`, `GEMINI_API_KEY` and `GROQ_API_KEY`
from Netlify; nothing on Netlify uses them any more.

## 3. Authentication and abuse protection

1. `verify_jwt = true` on both functions: the Supabase gateway rejects calls without a valid project JWT.
   The site sends the public anon key, so this is a gate, not a secret.
2. Origin allowlist: other websites cannot call the functions from a browser; requests without an
   `Origin` header are rejected.
3. Per-IP rate limit: chat 20/min, classify 8/min. Kept in memory per function instance, so it is
   best effort, not a global quota.
4. Size limits: question 1,000 characters, image 4 MB base64, MIME allowlist.
5. **Cost ceiling (do this in Google Cloud):** restrict the Gemini key to the
   "Generative Language API" and set a quota/budget alert on the project. Origin and IP checks can be
   bypassed by a determined script; the Gemini quota cannot.

A stronger option for later is a database-backed rate limit table or Supabase anonymous sign-ins with
per-user limits. Both need a new table, so they are not part of this change.

## 4. Deploying the functions

Version 2 of each function is deployed. The project-ref check in `chat` (the `wrong_project` guard)
was added after that deploy, so it becomes active with the next deploy. Deploy only after review:

```bash
supabase login
npm run supabase:deploy      # deploys chat and classify to uwxksbwlzjrjlccbdjtk only
```

`supabase/config.toml` keeps `verify_jwt = true` for both.

## 5. Tests

Offline unit tests (mocked Gemini and Supabase, no keys needed):

```bash
npm run test:functions
```

Live tests (Git Bash / macOS / Linux). `ANON` is the public anon key from the dashboard:

```bash
SB="https://uwxksbwlzjrjlccbdjtk.supabase.co"
ANON="<legacy anon key>"
SITE="https://recycling-ai-assistant2026.netlify.app"

# chat, Arabic (Jordanian) → 200 with an Arabic "answer"
curl -s "$SB/functions/v1/chat" -H "Origin: $SITE" -H "Authorization: Bearer $ANON" -H "apikey: $ANON" \
  -H "Content-Type: application/json" -d '{"question":"وين بحط علبة البيبسي الفاضية؟","lang":"ar"}'

# chat, English UI → English answer
curl -s "$SB/functions/v1/chat" -H "Origin: $SITE" -H "Authorization: Bearer $ANON" -H "apikey: $ANON" \
  -H "Content-Type: application/json" -d '{"question":"Where do empty cans go?","lang":"en"}'

# classify, using an image already in the repo → the six fields
IMG=$(base64 < public/items/can.webp | tr -d '\n')
printf '{"image":"%s","mimeType":"image/webp","lang":"ar"}' "$IMG" > /tmp/classify.json
curl -s "$SB/functions/v1/classify" -H "Origin: $SITE" -H "Authorization: Bearer $ANON" -H "apikey: $ANON" \
  -H "Content-Type: application/json" --data @/tmp/classify.json

# safeguards
curl -s -o /dev/null -w "%{http_code}\n" "$SB/functions/v1/chat" -H "Content-Type: application/json" -d '{"question":"x"}'            # 401 (no JWT)
curl -s -o /dev/null -w "%{http_code}\n" "$SB/functions/v1/chat" -H "Authorization: Bearer $ANON" -H "apikey: $ANON" \
  -H "Origin: https://evil.example" -H "Content-Type: application/json" -d '{"question":"x"}'                                     # 403
```

Function logs: Supabase → Edge Functions → chat / classify → Logs.

## 6. Rollback

- Frontend: revert the merge commit; Netlify redeploys the previous version (the old Netlify Functions come back with it).
- Edge Functions: the deployed v1 code is the first commit on this branch
  (`chore(supabase): snapshot ...`); redeploy it if needed.
