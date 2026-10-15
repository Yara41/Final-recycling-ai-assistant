
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function respond(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return respond({ error: "Method not allowed" }, 405);
  }

  try {
    const apiKey = Deno.env.get("GEMINI_API_KEY");

    if (!apiKey) {
      console.error("GEMINI_API_KEY is missing");
      return respond({ error: "Server configuration is incomplete." }, 500);
    }

    const body = await req.json();
    const image = body.image;
    const mimeType = body.mimeType || "image/jpeg";

    if (typeof image !== "string" || !image.trim()) {
      return respond({ error: "Please provide an image." }, 400);
    }

    const imageData = image.replace(/^data:image\/[^;]+;base64,/, "");

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/heic",
      "image/heif",
    ];

    if (!allowedTypes.includes(mimeType)) {
      return respond({ error: "Unsupported image format." }, 400);
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `Analyze this image for a university recycling awareness assistant in Jordan. Identify the visible item and provide a cautious recycling recommendation.

Return ONLY valid JSON with these fields:
{
  "is_waste": boolean,
  "item": "short item name",
  "category": "plastic|paper|metal|glass|organic|hazardous|general",
  "recyclable": boolean,
  "tip": "short practical recycling tip",
  "confidence": number
}

Use Arabic for item and tip. If the image is unclear, use general and explain the uncertainty in tip. Do not claim an item is recyclable locally unless the image or available information supports it.`,
                },
                {
                  inline_data: {
                    mime_type: mimeType,
                    data: imageData,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: "application/json",
          },
        }),
      },
    );

    if (!response.ok) {
      console.error("Gemini image request failed:", response.status);
      return respond({ error: "Could not analyze the image." }, 502);
    }

    const result = await response.json();
    const text = result.candidates?.[0]?.content?.parts
      ?.map((part: { text?: string }) => part.text ?? "")
      .join("")
      .trim();

    if (!text) {
      return respond({ error: "No classification was returned." }, 502);
    }

    let classification;

    try {
      classification = JSON.parse(text);
    } catch {
      console.error("Gemini returned invalid JSON");
      return respond({ error: "Could not read the image analysis." }, 502);
    }

    return respond(classification);
  } catch (error) {
    console.error("Classify function error:", error);
    return respond({ error: "The image could not be analyzed." }, 500);
  }
});
