// Supabase Edge Function: classify
// Deploy with JWT verification ON (the default):  supabase functions deploy classify
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { handleClassify } from "./handler.ts";

Deno.serve(handleClassify);
