import { GoogleGenAI } from "@google/genai";

function getGeminiClient() {
  const apiKey =
    process.env.GEMINI_API_KEY ||
    process.env.NEXT_PUBLIC_GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    null;
  if (!apiKey) return null;
  return new GoogleGenAI({ apiKey });
}

const MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";

/**
 * Flags a model response using Google Gemini API
 * Returns 0 if response is acceptable, 1 if unacceptable
 */
export async function flagResponseWithGemini(
  userMessage: string,
  modelResponse: string,
  context: string = "Cowboy Cafe - a western-themed restaurant chatbot"
): Promise<{ flag: 0 | 1; reasoning?: string }> {
  const ai = getGeminiClient();
  if (!ai) {
    console.warn("GEMINI_API_KEY not set - skipping response flagging");
    return { flag: 0 };
  }

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

    const response = await ai.models.generateContent({
      model: MODEL,
      contents: prompt,
      config: {
        temperature: 0,
        maxOutputTokens: 1,
      },
    });

    const text = response.text?.trim() ?? "0";
    const flagValue = parseInt(text, 10);

    if (flagValue === 0 || flagValue === 1) {
      return { flag: flagValue as 0 | 1 };
    }

    console.warn(`Unexpected Gemini response: ${text}`);
    return { flag: 0 };
  } catch (error) {
    if (error instanceof Error) {
      console.error("Gemini flagging error:", error.message);
    }
    return { flag: 0 };
  }
}

/** Categories for admin chat log flagging — helps admins identify what to improve */
export type GeminiFlagCategory =
  | "harmful"
  | "deceptive"
  | "toxic"
  | "inappropriate"
  | "off_topic"
  | "policy_violation";

export interface GeminiChatLogFlagResult {
  isProblematic: boolean;
  categories: GeminiFlagCategory[];
  reasoning?: string;
}

/**
 * Flags a chat log for admin review using Gemini.
 */
export async function flagChatLogForAdmin(
  userMessage: string,
  modelResponse: string,
  context: string = "Cowboy Cafe - a western-themed restaurant chatbot"
): Promise<GeminiChatLogFlagResult> {
  const ai = getGeminiClient();
  if (!ai) {
    console.warn("GEMINI_API_KEY not set - skipping chat log flagging");
    return { isProblematic: false, categories: [] };
  }

  try {
    const prompt = `You are a content moderation system for an AI safety admin dashboard. Given a user message and a chatbot's response, determine if the response has any issues an admin should review.

Context: ${context}
User Message: "${userMessage}"
Model Response: "${modelResponse}"

Evaluate the response and identify any of these categories that apply:
- harmful: provides dangerous instructions (e.g. how to harm people, illegal activities)
- deceptive: misleading, impersonation, or fraudulent content
- toxic: hateful, harassing, or abusive language
- inappropriate: sexually explicit, offensive, or unsuitable content
- off_topic: completely unrelated to the context or user's question
- policy_violation: violates the chatbot's guidelines or system instructions

Respond with ONLY a valid JSON object, no other text. Example format:
{"isProblematic": true, "categories": ["harmful", "toxic"], "reasoning": "Brief explanation"}

If the response is acceptable and no categories apply:
{"isProblematic": false, "categories": [], "reasoning": "Response is appropriate"}

Rules: categories must be from the list above only. reasoning should be one short sentence.`;

    const response = await ai.models.generateContent({
      model: MODEL,
      contents: prompt,
      config: {
        temperature: 0,
        maxOutputTokens: 256,
      },
    });

    const text = response.text?.trim() ?? "";
    if (!text) return { isProblematic: false, categories: [] };

    let jsonStr = text;
    const codeMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeMatch) jsonStr = codeMatch[1].trim();

    const parsed = JSON.parse(jsonStr) as {
      isProblematic?: boolean;
      categories?: string[];
      reasoning?: string;
    };

    const validCategories: GeminiFlagCategory[] = [
      "harmful",
      "deceptive",
      "toxic",
      "inappropriate",
      "off_topic",
      "policy_violation",
    ];
    const categories = (parsed.categories || [])
      .filter((c): c is GeminiFlagCategory =>
        validCategories.includes(c as GeminiFlagCategory)
      );

    return {
      isProblematic: Boolean(parsed.isProblematic) || categories.length > 0,
      categories,
      reasoning: parsed.reasoning,
    };
  } catch (error) {
    if (error instanceof Error) {
      console.error("Gemini chat log flagging error:", error.message);
    }
    return { isProblematic: false, categories: [] };
  }
}
