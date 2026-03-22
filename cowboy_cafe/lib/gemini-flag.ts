/**
 * Flags a model response using Google Gemini API
 * Returns 0 if response is acceptable, 1 if unacceptable
 */
export async function flagResponseWithGemini(
  userMessage: string,
  modelResponse: string,
  context: string = "Cowboy Cafe - a western-themed restaurant chatbot"
): Promise<{ flag: 0 | 1; reasoning?: string }> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || "gemini-1.5-flash";

  if (!apiKey) {
    console.warn("GEMINI_API_KEY not set - skipping response flagging");
    return { flag: 0 }; // Default to acceptable if no API key
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

  try {
    const prompt = `You are a content moderation system. Given a user message, a chatbot's response, and context, determine if the response is acceptable.

Context: ${context}
User Message: "${userMessage}"
Model Response: "${modelResponse}"

Evaluate if the response is appropriate given:
1. Is it relevant to the user's question?
2. Does it maintain the persona/context?
3. Is it free from harmful, offensive, or inappropriate content?
4. Does it follow the system guidelines?

Respond with ONLY a single number:
- 0 if the response is ACCEPTABLE
- 1 if the response is UNACCEPTABLE

Do not include any explanation, just the number.`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0,
          maxOutputTokens: 1,
        },
      }),
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(
        `Gemini API error (${response.status}):`,
        error.slice(0, 200)
      );
      return { flag: 0 }; // Default to acceptable on error
    }

    const data = (await response.json()) as {
      candidates?: Array<{
        content?: {
          parts?: Array<{
            text?: string;
          }>;
        };
      }>;
    };

    const flagText =
      data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "0";
    const flagValue = parseInt(flagText, 10);

    if (flagValue === 0 || flagValue === 1) {
      return { flag: flagValue as 0 | 1 };
    }

    console.warn(`Unexpected Gemini response: ${flagText}`);
    return { flag: 0 };
  } catch (error) {
    if (error instanceof Error) {
      console.error("Gemini flagging error:", error.message);
    }
    return { flag: 0 }; // Default to acceptable on error
  }
}
