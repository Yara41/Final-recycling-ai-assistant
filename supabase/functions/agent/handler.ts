// EcoWasteAI agent endpoint.
// Request:  { message, image?, mimeType?, conversationId?, lang } + Authorization: Bearer <user access token>
// Response: { reply, actions: ActionCard[], conversationId }
// Errors:   { error, code }  401 unauthorized | 409 needs_onboarding | 429 rate_limited |
//           400 missing_message/bad_image | 413 too_large | 503 model_unavailable
import type { GeminiContent } from "../_shared/gemini.ts";
import { guard, HttpError, json, rateLimit } from "../_shared/security.ts";
import { getUser, restGet, serviceRpc } from "../_shared/supabase.ts";
import { runAgent } from "./loop.ts";
import { isUuid, MAX_IMAGE_BASE64_CHARS } from "./tools/util.ts";
import type { ActionCard, Role, ToolContext, University } from "./types.ts";

const MAX_MESSAGE_CHARS = 1000;
const HISTORY_MESSAGES = 12;
const USER_LIMIT = 30;
const USER_WINDOW_MS = 10 * 60_000;
const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

type ProfileRow = { role: Role; faculty: string | null; university_id: string; universities: University };

// Lets the model remember what it did in earlier turns (places, items), not only what it said.
function withActions(text: string, actions: ActionCard[] | undefined): string {
  if (!actions?.length) return text;
  const done = actions.map((a) => (a.detail ? `${a.title} (${a.detail})` : a.title)).join("; ");
  return `${text}\n[Actions done: ${done}]`;
}

function bearer(req: Request): string {
  const h = req.headers.get("authorization") ?? "";
  return h.toLowerCase().startsWith("bearer ") ? h.slice(7).trim() : "";
}

function readImage(body: Record<string, unknown>): { data: string; mimeType: string } | undefined {
  if (typeof body.image !== "string" || !body.image.trim()) return undefined;
  const dataUrl = body.image.match(/^data:(image\/[a-z0-9.+-]+);base64,/i);
  let mimeType = typeof body.mimeType === "string" ? body.mimeType.toLowerCase().trim() : dataUrl?.[1]?.toLowerCase() ?? "image/jpeg";
  if (mimeType === "image/jpg") mimeType = "image/jpeg";
  const data = body.image.replace(/^data:[^,]*,/, "").replace(/\s+/g, "");
  if (data.length > MAX_IMAGE_BASE64_CHARS) throw new HttpError(413, "too_large", "Image is too large");
  if (!ALLOWED_MIME.includes(mimeType) || data.length < 100 || !/^[A-Za-z0-9+/]+={0,2}$/.test(data)) {
    throw new HttpError(400, "bad_image", "The image could not be read. Please try another photo.");
  }
  return { data, mimeType };
}

export async function handleAgent(req: Request): Promise<Response> {
  const checked = await guard(req, { name: "agent", perMinute: 20, maxBodyChars: MAX_IMAGE_BASE64_CHARS + 2_000 });
  if (checked instanceof Response) return checked;
  const { body, cors } = checked;

  try {
    const jwt = bearer(req);
    const user = await getUser(jwt);
    if (!user) return json({ error: "Please sign in again.", code: "unauthorized" }, 401, cors);

    const lang = body.lang === "en" ? "en" : "ar";
    const message = String(body.message ?? "").trim().slice(0, MAX_MESSAGE_CHARS);
    const image = readImage(body);
    if (!message && !image) return json({ error: "Message is required", code: "missing_message" }, 400, cors);

    const [profile] = await restGet<ProfileRow[]>(
      jwt,
      `profiles?select=role,faculty,university_id,universities(id,name,country,bins,sorting_rules,points_per_item,default_language)&user_id=eq.${user.id}`,
    );
    if (!profile?.universities) {
      return json({ error: "Choose your university first.", code: "needs_onboarding" }, 409, cors);
    }

    const wait = rateLimit(`agent-user:${user.id}`, USER_LIMIT, USER_WINDOW_MS);
    if (wait > 0) {
      return json({ error: "You're sending messages very fast. Please wait a little.", code: "rate_limited" }, 429, cors, {
        "Retry-After": String(wait),
      });
    }

    const conversationId = isUuid(body.conversationId) ? body.conversationId : null;
    const history: GeminiContent[] = [];
    if (conversationId) {
      const rows = await restGet<{ role: string; content: string; actions?: ActionCard[] }[]>(
        jwt,
        `messages?select=role,content,actions&conversation_id=eq.${conversationId}&order=id.desc&limit=${HISTORY_MESSAGES}`,
      );
      for (const m of rows.reverse()) {
        history.push({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: withActions(m.content, m.actions) }] });
      }
    }

    const ctx: ToolContext = {
      userId: user.id,
      role: profile.role,
      jwt,
      lang,
      university: profile.universities,
      conversationId,
      image,
    };
    const result = await runAgent({ ctx, history, message, hasImage: Boolean(image) });

    let savedId: string | null = conversationId;
    try {
      savedId = await serviceRpc<string>("save_agent_turn", {
        p_user: user.id,
        p_conversation: conversationId,
        p_user_text: message || (lang === "en" ? "[photo]" : "[صورة]"),
        p_reply: result.reply,
        p_actions: result.records,
      });
    } catch (err) {
      console.error("could not save agent turn:", err);
    }

    return json({ reply: result.reply, actions: result.actions, conversationId: savedId }, 200, cors);
  } catch (err) {
    if (err instanceof HttpError) return json({ error: err.message, code: err.code }, err.status, cors);
    console.error("agent function error:", err);
    return json({ error: "Something went wrong", code: "server_error" }, 500, cors);
  }
}
