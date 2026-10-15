// Supabase Edge Function: chat
// Deploy with JWT verification ON (the default):  supabase functions deploy chat
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { handleChat } from "./handler.ts";

Deno.serve(handleChat);
