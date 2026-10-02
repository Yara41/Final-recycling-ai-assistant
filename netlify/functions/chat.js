export async function handler(event) {
  try {
    if (event.httpMethod !== "POST") {
      return {
        statusCode: 405,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          error: "Method not allowed",
        }),
      };
    }

    const body = JSON.parse(event.body || "{}");
    const question = body.question?.trim();

    if (!question) {
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          error: "Question is required",
        }),
      };
    }

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_KEY = process.env.SUPABASE_KEY;
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

    if (!SUPABASE_URL || !SUPABASE_KEY || !GEMINI_API_KEY) {
      return {
        statusCode: 500,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          error: "Missing required environment variables",
          hasSupabaseUrl: !!SUPABASE_URL,
          hasSupabaseKey: !!SUPABASE_KEY,
          hasGeminiKey: !!GEMINI_API_KEY,
        }),
      };
    }

    // =====================================================
    // 1. Create embedding using Gemini
    // =====================================================

    const embeddingResponse = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": GEMINI_API_KEY,
        },
        body: JSON.stringify({
          model: "models/gemini-embedding-001",
          content: {
            parts: [
              {
                text: question,
              },
            ],
          },
          outputDimensionality: 3072,
        }),
      }
    );

    const embeddingData = await embeddingResponse.json();

    if (!embeddingResponse.ok) {
      console.error("Gemini embedding error:", embeddingData);

      return {
        statusCode: 500,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          error: "Gemini embedding failed",
          details: embeddingData,
        }),
      };
    }

    const queryEmbedding = embeddingData?.embedding?.values;

    if (!Array.isArray(queryEmbedding)) {
      return {
        statusCode: 500,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          error: "Gemini did not return a valid embedding",
        }),
      };
    }

    console.log(
      "Gemini embedding created. Dimensions:",
      queryEmbedding.length
    );

    // =====================================================
    // 2. Search existing Supabase RAG database
    // =====================================================

    const supabaseResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/rpc/match_documents`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
        body: JSON.stringify({
          query_embedding: queryEmbedding,
          match_count: 6,
          filter: {},
        }),
      }
    );

    const documents = await supabaseResponse.json();

    if (!supabaseResponse.ok) {
      console.error("Supabase error:", documents);

      return {
        statusCode: 500,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          error: "Supabase search failed",
          details: documents,
        }),
      };
    }

    console.log(
      "Documents retrieved:",
      Array.isArray(documents) ? documents.length : 0
    );

    // =====================================================
    // 3. Build context from retrieved documents
    // =====================================================

    const context = Array.isArray(documents)
      ? documents
          .map((doc, index) => {
            return `SOURCE ${index + 1}

${doc.content || ""}`;
          })
          .join("\n\n--------------------\n\n")
      : "";

    // =====================================================
    // TEMPORARY TEST
    // We return the retrieved information directly.
    // Groq will be added after we confirm RAG works.
    // =====================================================

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        answer:
          context ||
          "تم الاتصال بقاعدة البيانات، لكن لم يتم العثور على معلومات مناسبة لسؤالك.",
        documentsFound: Array.isArray(documents) ? documents.length : 0,
      }),
    };
  } catch (error) {
    console.error("CHAT FUNCTION ERROR:", error);

    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        error: "Server error",
        details: error.message,
      }),
    };
  }
}
