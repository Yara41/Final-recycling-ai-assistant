// Supabase Edge Function: agent
// Deploy with JWT verification ON (the default):  supabase functions deploy agent
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { handleAgent } from "./handler.ts";

Deno.serve(handleAgent);
