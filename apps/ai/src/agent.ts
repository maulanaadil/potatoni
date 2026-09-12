import Anthropic from "@anthropic-ai/sdk";
import { env } from "./env.ts";
import { HttpError } from "./http.ts";
import { systemPrompt } from "./prompt.ts";
import { jakartaTodayLabel } from "./time.ts";
import { runTool, tools } from "./tools.ts";

export type ChatMessage = { role: "user" | "assistant"; content: string };

// The SDK retries 429 / 5xx / 529 "overloaded" with backoff on its own.
const client = new Anthropic({ apiKey: env.anthropicApiKey });

// Model turns per answer (tool rounds and web-search resumes). The last one must answer in text.
const MAX_ROUNDS = 8;

// If Opus 5 / Fable declines a request, the API re-runs it on Anthropic's recommended fallback model.
const REFUSAL_FALLBACK: Pick<Anthropic.Beta.MessageCreateParamsNonStreaming, "betas" | "fallbacks"> =
  /^claude-(opus-5|fable-5)/.test(env.anthropicModel)
    ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" }
    : {};

const isToolError = (result: unknown) => typeof result === "object" && result !== null && "error" in result;

/**
 * One assistant turn. The dashboard sends the visible conversation each time (the service is
 * stateless); Claude calls tools as often as it needs, then answers in text.
 */
export async function chat(messages: ChatMessage[], user: { name: string }) {
  const history: Anthropic.Beta.BetaMessageParam[] = messages.map((m) => ({ role: m.role, content: m.content }));
  const system = systemPrompt({ userName: user.name, today: jakartaTodayLabel() });
  const used = new Set<string>();
  // Web search filters its results in a code-execution container, and Claude may call our tools
  // from inside it; once the API has opened one, every later request must name it.
  let container: string | undefined;

  for (let round = 1; ; round++) {
    const response = await client.beta.messages.create({
      model: env.anthropicModel,
      max_tokens: 16000,
      ...REFUSAL_FALLBACK,
      ...(container ? { container } : {}),
      // Caches tools + system + the conversation so far, so each tool round re-reads it cheaply.
      cache_control: { type: "ephemeral" },
      system,
      tools,
      ...(round === MAX_ROUNDS ? { tool_choice: { type: "none" } } : {}),
      messages: history,
    });
    container = response.container?.id ?? container;

    for (const block of response.content) {
      if (block.type === "tool_use" || block.type === "server_tool_use") used.add(block.name);
    }

    if (response.stop_reason === "refusal") {
      throw new HttpError(422, "The assistant can't help with that one — try asking another way");
    }

    // Web search hit its server-side step limit: send the turn back unchanged and it resumes.
    if (response.stop_reason === "pause_turn") {
      history.push({ role: "assistant", content: response.content });
      continue;
    }

    const calls = response.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
    if (response.stop_reason === "tool_use" && calls.length > 0) {
      history.push({ role: "assistant", content: response.content });
      // Every result goes back in one message, so Claude keeps calling tools in parallel.
      const results = await Promise.all(
        calls.map(async (call): Promise<Anthropic.Beta.BetaToolResultBlockParam> => {
          const result = await runTool(call.name, call.input);
          return {
            type: "tool_result",
            tool_use_id: call.id,
            content: JSON.stringify(result),
            is_error: isToolError(result),
          };
        }),
      );
      history.push({ role: "user", content: results });
      continue;
    }

    const reply = withSources(response.content);
    if (!reply) throw new HttpError(502, "The assistant returned an empty answer — please try again");
    return { reply, tools: [...used] };
  }
}

/** The answer text, plus the web pages Claude cited from web search as a "Sources" list. */
function withSources(content: Anthropic.Beta.BetaContentBlock[]) {
  const sources = new Map<string, string>();
  let text = "";
  for (const block of content) {
    if (block.type !== "text") continue;
    text += block.text;
    for (const citation of block.citations ?? []) {
      if (citation.type === "web_search_result_location") sources.set(citation.url, citation.title ?? citation.url);
    }
  }
  text = text.trim();
  if (!text || sources.size === 0) return text;
  return `${text}\n\nSources:\n${[...sources].map(([url, title]) => `- [${title}](${url})`).join("\n")}`;
}
