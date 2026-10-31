// Supabase Edge Function: insights (weekly, called by pg_cron)
// Deploy with JWT verification OFF; the function checks the x-cron-secret header itself:
//   supabase functions deploy insights --no-verify-jwt
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { handleInsights } from "./handler.ts";

Deno.serve(handleInsights);
