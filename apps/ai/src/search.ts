import { GeminiError, generateContent, textOf } from "./gemini.ts";
import { jakartaToday } from "./time.ts";

/**
 * Google Search grounding runs as its own Gemini call, so it doesn't have to share a
 * request with the function declarations (the API doesn't allow mixing them on every model).
 */
export async function searchWeb(query: string) {
  try {
    const res = await generateContent({
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `Today is ${jakartaToday()} (WIB). ${query}\n\nAnswer with concrete facts: event names, dates, venues, organisers, ticket/booth info and links. Mark anything you couldn't confirm as unconfirmed.`,
            },
          ],
        },
      ],
      tools: [{ google_search: {} }],
    });
    const candidate = res.candidates?.[0];
    const sources = (candidate?.groundingMetadata?.groundingChunks ?? []).flatMap((chunk) =>
      chunk.web ? [{ title: chunk.web.title ?? chunk.web.uri, url: chunk.web.uri }] : [],
    );
    return { answer: textOf(candidate?.content), sources };
  } catch (err) {
    if (!(err instanceof GeminiError)) throw err;
    console.warn(`[search] ${err.status} ${err.message}`);
    return {
      error:
        err.status === 429
          ? "Live web search is out of quota right now. Say so, and answer from the database and general knowledge instead."
          : "Live web search failed. Say so, and answer from the database and general knowledge instead.",
    };
  }
}
