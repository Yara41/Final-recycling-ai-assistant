
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!geminiKey || !supabaseUrl || !supabaseKey) {
      throw new Error("Required server configuration is missing.");
    }

    const body = await req.json();
    const question =
      typeof body.question === "string" ? body.question.trim() : "";

    if (!question) {
      return jsonResponse({ error: "Please enter a question." }, 400);
    }

    // 1. Create an embedding for the user's question.
    const embeddingResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${geminiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: { parts: [{ text: question }] },
          outputDimensionality: 3072,
        }),
      },
    );

    if (!embeddingResponse.ok) {
      console.error("Embedding request failed:", embeddingResponse.status);
      return jsonResponse({ error: "Could not process the question." }, 502);
    }

    const embeddingData = await embeddingResponse.json();
    const embedding = embeddingData.embedding?.values;

    if (!Array.isArray(embedding) || embedding.length !== 3072) {
      throw new Error("The embedding has an unexpected dimension.");
    }

    // 2. Search the existing recycling knowledge base.
    const rpcResponse = await fetch(
      `${supabaseUrl}/rest/v1/rpc/match_documents`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({
          query_embedding: embedding,
          match_count: 30,
          filter: {},
        }),
      },
    );

    if (!rpcResponse.ok) {
      console.error("Document search failed:", rpcResponse.status);
      return jsonResponse({ error: "Could not search the knowledge base." }, 502);
    }

    const documents = await rpcResponse.json();

    const context = (Array.isArray(documents) ? documents : [])
      .slice(0, 6)
      .map((doc: { content?: string }) => doc.content ?? "")
      .filter(Boolean)
      .join("\n\n---\n\n")
      .slice(0, 12000);

    if (!context) {
      return jsonResponse({
        answer: "عذرًا، لم أجد معلومات مناسبة في المصادر المتاحة للإجابة عن سؤالك. جرّبي صياغة السؤال بطريقة أخرى.",
      });
    }

    // 3. Generate an answer using Gemini.
    const answerResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{
              text: "You are an Arabic-first recycling awareness assistant for university students in Jordan. Answer using only the supplied reference context. If the context does not contain the answer, clearly say that the available sources do not provide enough information. Reply in the same language as the user's question. Be friendly, concise, practical, and environmentally responsible. Do not invent recycling rules or local facilities.",
            }],
          },
          contents: [{
            role: "user",
            parts: [{
              text: `Reference context:\n${context}\n\nUser question:\n${question}`,
            }],
          }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 900,
          },
        }),
      },
    );

    if (!answerResponse.ok) {
      console.error("Gemini answer request failed:", answerResponse.status);
      return jsonResponse({ error: "Could not generate an answer." }, 502);
    }

    const answerData = await answerResponse.json();
    const answer = answerData.candidates?.[0]?.content?.parts
      ?.map((part: { text?: string }) => part.text ?? "")
      .join("")
      .trim();

    if (!answer) {
      return jsonResponse({ error: "No answer was returned. Please try again." }, 502);
    }

    return jsonResponse({ answer });
  } catch (error) {
    console.error("Chat function error:", error);
    return jsonResponse({ error: "The assistant could not complete your request." }, 500);
  }
});
