export async function handler(event) {
  try {
    if (event.httpMethod !== "POST") {
      return {
        statusCode: 405,
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
        body: JSON.stringify({
          error: "Question is required",
        }),
      };
    }

    // =========================
    // Environment Variables
    // =========================
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_KEY = process.env.SUPABASE_KEY;
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    const GROQ_API_KEY = process.env.GROQ_API_KEY;

    if (!SUPABASE_URL || !SUPABASE_KEY || !GEMINI_API_KEY || !GROQ_API_KEY) {
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: "Missing required environment variables",
        }),
      };
    }

    // =========================================================
    // 1. Create embedding for the user's question using Gemini
    // =========================================================
    const embeddingResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent`,
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
        body: JSON.stringify({
          error: "Failed to create embedding",
          details: embeddingData,
        }),
      };
    }

    const queryEmbedding = embeddingData?.embedding?.values;

    if (!queryEmbedding || !Array.isArray(queryEmbedding)) {
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: "Invalid embedding returned from Gemini",
        }),
      };
    }

    // =========================================================
    // 2. Search the existing Supabase vector database
    // =========================================================
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
      console.error("Supabase RPC error:", documents);

      return {
        statusCode: 500,
        body: JSON.stringify({
          error: "Failed to search knowledge base",
          details: documents,
        }),
      };
    }

    // =========================================================
    // 3. Build the RAG context
    // =========================================================
    const context = Array.isArray(documents)
      ? documents
          .map((doc, index) => {
            return `SOURCE ${index + 1}
${doc.content}
Similarity: ${doc.similarity}`;
          })
          .join("\n\n---\n\n")
      : "";

    // =========================================================
    // 4. Ask Groq to formulate the final answer
    // =========================================================
    const systemPrompt = `
You are a helpful university recycling and waste-management assistant.

Your job is to answer the user's question using the provided knowledge base.

IMPORTANT RULES:

1. Use the retrieved context as your main source of factual information.
2. Do not invent facts that are not supported by the context.
3. If the context does not contain enough information to answer the question, clearly say that the available information does not provide the answer.
4. Understand Arabic, English, and Jordanian colloquial Arabic.
5. The user may ask questions using dialect, informal spelling, abbreviations, or mixed Arabic-English.
6. Understand the user's intended meaning naturally rather than requiring formal Arabic.
7. Answer in the same language the user uses.
8. Do not mention "the database", "retrieved documents", "RAG", embeddings, or technical implementation unless the user specifically asks.
9. Do not copy the retrieved text unnecessarily. Explain it naturally.
10. Keep answers clear, useful, and reasonably concise.
11. If the user asks for steps, provide numbered steps.
12. If the question is ambiguous, use the available context to interpret it when reasonably possible.
13. Never make up university rules, recycling regulations, locations, procedures, or contact information.

Retrieved knowledge:

${context}
`;

    const groqResponse = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: "openai/gpt-oss-120b",
          messages: [
            {
              role: "system",
              content: systemPrompt,
            },
            {
              role: "user",
              content: question,
            },
          ],
          temperature: 0.2,
          max_completion_tokens: 1000,
        }),
      }
    );

    const groqData = await groqResponse.json();

    if (!groqResponse.ok) {
      console.error("Groq error:", groqData);

      return {
        statusCode: 500,
        body: JSON.stringify({
          error: "Failed to generate answer",
          details: groqData,
        }),
      };
    }

    const answer =
      groqData?.choices?.[0]?.message?.content?.trim() ||
      "عذرًا، لم أتمكن من تكوين إجابة.";

    // =========================================================
    // 5. Return answer to React
    // =========================================================
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        answer,
        output: answer,
        text: answer,
        sources: Array.isArray(documents)
          ? documents.map((doc) => ({
              id: doc.id,
              similarity: doc.similarity,
            }))
          : [],
      }),
    };
  } catch (error) {
    console.error("Chat function error:", error);

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Something went wrong",
        details: error.message,
      }),
    };
  }
}
