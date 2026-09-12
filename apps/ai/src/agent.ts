import { generateContent, textOf, type Content, type Part } from "./gemini.ts";
import { HttpError } from "./http.ts";
import { systemPrompt } from "./prompt.ts";
import { jakartaTodayLabel } from "./time.ts";
import { functionDeclarations, runTool } from "./tools.ts";

export type ChatMessage = { role: "user" | "assistant"; content: string };

// Enough for "overview → sales → products → locations → web search" in one answer.
const MAX_TOOL_ROUNDS = 6;

/**
 * One assistant turn. The dashboard sends the visible conversation each time (the service is
 * stateless); the model calls tools as often as it needs, then answers in text.
 */
export async function chat(messages: ChatMessage[], user: { name: string }) {
  const contents: Content[] = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
  const base = {
    systemInstruction: { parts: [{ text: systemPrompt({ userName: user.name, today: jakartaTodayLabel() }) }] },
    tools: [{ functionDeclarations }],
  };
  const used = new Set<string>();

  for (let round = 0; ; round++) {
    // Last round: no more tool calls, answer with what's been gathered.
    const final = round === MAX_TOOL_ROUNDS;
    const res = await generateContent({
      ...base,
      contents,
      ...(final ? { toolConfig: { functionCallingConfig: { mode: "NONE" } } } : {}),
    });
    const content = res.candidates?.[0]?.content;
    const calls = content?.parts.flatMap((p) => (p.functionCall ? [p.functionCall] : [])) ?? [];

    if (!content || calls.length === 0 || final) {
      const reply = textOf(content);
      if (!reply) {
        throw new HttpError(
          502,
          res.promptFeedback?.blockReason
            ? "The AI model declined to answer that"
            : "The AI model returned an empty answer — please try again",
        );
      }
      return { reply, tools: [...used] };
    }

    // Echo the model's turn unchanged (it carries thought signatures), then the tool results.
    contents.push({ role: "model", parts: content.parts });
    const results: Part[] = await Promise.all(
      calls.map(async (call) => {
        used.add(call.name);
        const result = await runTool(call.name, call.args);
        return { functionResponse: { ...(call.id ? { id: call.id } : {}), name: call.name, response: { result } } };
      }),
    );
    contents.push({ role: "user", parts: results });
  }
}
