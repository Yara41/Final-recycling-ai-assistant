// EcoWasteAI image classification.
// Request  (same as the old netlify/functions/classify.mjs):
//   { image: "<base64 JPEG, with or without data: prefix>", mimeType?: "image/jpeg", lang?: "ar" | "en" }
// Response (fields used by ClassificationCard in src/App.jsx):
//   { is_waste, item, category, recyclable, tip, confidence }

import {
  env,
  guard,
  HttpError,
  json,
  timedFetch,
  upstreamReason,
} from "../_shared/security.ts";

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

// The website resizes photos to max 1024px JPEG (~100-400 KB), so 4 MB of base64
// leaves plenty of room while blocking oversized uploads.
const MAX_IMAGE_BASE64_CHARS = 4_000_000;
const MAX_BODY_CHARS = MAX_IMAGE_BASE64_CHARS + 2_000;

const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
export const CATEGORIES = ["plastic", "paper", "metal", "glass", "organic", "hazardous", "general"] as const;

// Prompt and sorting rules carried over unchanged from netlify/functions/classify.mjs
const PROMPT = `أنت نظام تصنيف نفايات لتطبيق EcoWasteAI في الجامعات الأردنية.
حلّل الصورة وحدد العنصر الرئيسي فيها وأجب بـ JSON فقط.

قواعد الفرز المعتمدة:
- البلاستيك: العبوات النظيفة وأغطيتها وعبوات المنظفات الفارغة تُعاد تدويرها. البوليسترين/الفوم وأكياس الشيبس والحلويات والأكياس المتسخة لا تُعاد.
- الورق والكرتون: النظيف والجاف فقط. المناديل الورقية والكرتون الدهني أو الملوث بالطعام (مثل علب البيتزا) لا يُعاد.
- المعادن: علب المشروبات والطعام النظيفة تُعاد. المتسخة بالزيوت أو المواد الخطرة لا.
- النفايات الخطرة (بطاريات، أدوية، إلخ) تذهب لنقاط جمع مخصصة ولا تُخلط أبداً.

الحقول:
- is_waste: هل في الصورة عنصر يمكن اعتباره نفاية؟ (false إذا الصورة لشخص أو مكان أو شيء غير واضح)
- item: اسم العنصر بالعربية باختصار (مثال: عبوة مياه بلاستيكية)
- category: plastic | paper | metal | glass | organic | hazardous | general
- recyclable: هل يُعاد تدويره بحالته الظاهرة في الصورة؟
- tip: نصيحة عملية قصيرة بالعربية (جملة أو جملتان) عن كيفية التخلص منه
- confidence: رقم من 0 إلى 1 يعبّر عن ثقتك

لا تخمّن: إذا الصورة غير واضحة اجعل confidence منخفضة.`;

const ENGLISH_NOTE =
  "\n\nملاحظة: المستخدم يستعمل الواجهة الإنجليزية، لذلك اكتب قيمتي item و tip باللغة الإنجليزية (بقية الحقول كما هي).";

const SCHEMA = {
  type: "OBJECT",
  properties: {
    is_waste: { type: "BOOLEAN" },
    item: { type: "STRING" },
    category: { type: "STRING", enum: [...CATEGORIES] },
    recyclable: { type: "BOOLEAN" },
    tip: { type: "STRING" },
    confidence: { type: "NUMBER" },
  },
  required: ["is_waste", "item", "category", "recyclable", "tip", "confidence"],
};

export type Classification = {
  is_waste: boolean;
  item: string;
  category: typeof CATEGORIES[number];
  recyclable: boolean;
  tip: string;
  confidence: number;
};

// Makes sure the UI always receives the exact fields and types it expects.
export function normalize(raw: Record<string, unknown>, lang: "ar" | "en"): Classification {
  const category = CATEGORIES.includes(raw.category as typeof CATEGORIES[number])
    ? (raw.category as typeof CATEGORIES[number])
    : "general";
  let confidence = Number(raw.confidence);
  if (!Number.isFinite(confidence)) confidence = 0;
  if (confidence > 1 && confidence <= 100) confidence = confidence / 100; // model sometimes answers in %
  confidence = Math.min(1, Math.max(0, confidence));
  const item = String(raw.item ?? "").trim().slice(0, 120);
  return {
    is_waste: typeof raw.is_waste === "boolean" ? raw.is_waste : true,
    item: item || (lang === "en" ? "Unidentified item" : "عنصر غير محدد"),
    category,
    recyclable: raw.recyclable === true,
    tip: String(raw.tip ?? "").trim().slice(0, 500),
    confidence,
  };
}

function visionModels(): string[] {
  const preferred = env("GEMINI_VISION_MODEL") || "gemini-flash-latest";
  return [...new Set([preferred, "gemini-2.5-flash"])];
}

async function classifyImage(imageData: string, mimeType: string, lang: "ar" | "en"): Promise<Classification> {
  let lastError = "unknown error";
  for (const model of visionModels()) {
    let res: Response;
    try {
      res = await timedFetch(
        `${GEMINI_BASE}/${model}:generateContent`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": env("GEMINI_API_KEY") },
          body: JSON.stringify({
            contents: [{
              role: "user",
              parts: [
                { text: lang === "en" ? PROMPT + ENGLISH_NOTE : PROMPT },
                { inline_data: { mime_type: mimeType, data: imageData } },
              ],
            }],
            generationConfig: {
              temperature: 0.2,
              responseMimeType: "application/json",
              responseSchema: SCHEMA,
            },
          }),
        },
        40_000,
      );
    } catch (err) {
      lastError = `${model}: ${(err as Error).message}`;
      console.error(lastError);
      continue;
    }

    if (!res.ok) {
      lastError = `${model} HTTP ${res.status}: ${await upstreamReason(res)}`;
      console.error("Gemini vision failed:", lastError);
      if (res.status === 401 || res.status === 403) break;
      if (res.status === 400) {
        // Usually a corrupt or unsupported image: another model will not help.
        throw new HttpError(400, "bad_image", "The image could not be read. Please try another photo.");
      }
      continue;
    }

    const data = await res.json();
    const text = (data?.candidates?.[0]?.content?.parts ?? [])
      .map((p: { text?: string; thought?: boolean }) => (p.thought ? "" : p.text ?? ""))
      .join("")
      .trim();
    if (!text) {
      lastError = `${model} returned no text (finishReason: ${data?.candidates?.[0]?.finishReason ?? "none"}, ` +
        `blockReason: ${data?.promptFeedback?.blockReason ?? "none"})`;
      console.error(lastError);
      continue;
    }

    try {
      const cleaned = text.replace(/^```(?:json)?\s*|\s*```$/g, "");
      return normalize(JSON.parse(cleaned), lang);
    } catch {
      lastError = `${model} returned invalid JSON`;
      console.error(lastError, text.slice(0, 200));
    }
  }
  throw new HttpError(502, "classification_failed", "Classification failed.");
}

export async function handleClassify(req: Request): Promise<Response> {
  const checked = await guard(req, { name: "classify", perMinute: 8, maxBodyChars: MAX_BODY_CHARS });
  if (checked instanceof Response) return checked;
  const { body, cors } = checked;

  try {
    if (!env("GEMINI_API_KEY")) {
      console.error("Missing secret: GEMINI_API_KEY");
      throw new HttpError(500, "server_config", "Server configuration error.");
    }

    if (typeof body.image !== "string" || !body.image.trim()) {
      return json({ error: "No image provided", code: "missing_image" }, 400, cors);
    }

    // Accept both raw base64 (what the website sends) and a full data: URL.
    let mimeType = typeof body.mimeType === "string" ? body.mimeType.toLowerCase().trim() : "";
    const dataUrl = body.image.match(/^data:(image\/[a-z0-9.+-]+);base64,/i);
    if (dataUrl && !mimeType) mimeType = dataUrl[1].toLowerCase();
    if (!mimeType) mimeType = "image/jpeg";
    if (mimeType === "image/jpg") mimeType = "image/jpeg";
    if (!ALLOWED_MIME.includes(mimeType)) {
      return json({ error: "Unsupported image format", code: "bad_mime" }, 400, cors);
    }

    const imageData = body.image.replace(/^data:[^,]*,/, "").replace(/\s+/g, "");
    if (imageData.length > MAX_IMAGE_BASE64_CHARS) {
      return json({ error: "Image is too large", code: "too_large" }, 413, cors);
    }
    if (imageData.length < 100 || !/^[A-Za-z0-9+/]+={0,2}$/.test(imageData)) {
      return json({ error: "Image is not valid base64", code: "bad_image" }, 400, cors);
    }

    const lang = body.lang === "en" ? "en" : "ar";
    const result = await classifyImage(imageData, mimeType, lang);
    return json(result, 200, cors);
  } catch (err) {
    if (err instanceof HttpError) {
      return json({ error: err.message, code: err.code }, err.status, cors);
    }
    console.error("classify function error:", err);
    return json({ error: "Server error", code: "server_error" }, 500, cors);
  }
}
