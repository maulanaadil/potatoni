import Anthropic from "@anthropic-ai/sdk";
import { env } from "./env.ts";
import { HttpError } from "./http.ts";
import { systemPrompt } from "./prompt.ts";
import { type Action, isProposal, proposalTools, readProposal } from "./proposals.ts";
import { jakartaTodayLabel } from "./time.ts";
import { tools as dataTools, runTool } from "./tools.ts";

export type ImageInput = { media_type: "image/png" | "image/jpeg" | "image/webp"; data: string };
export type ChatMessage = { role: "user" | "assistant"; content: string; images?: ImageInput[] };

// The SDK retries 429 / 5xx / 529 "overloaded" with backoff on its own.
const client = new Anthropic({ apiKey: env.anthropicApiKey });

const tools = [...dataTools, ...proposalTools];

// Model turns per answer (tool rounds and web-search resumes). The last one must answer in text.
const MAX_ROUNDS = 8;

// If Opus 5 / Fable declines a request, the API re-runs it on Anthropic's recommended fallback model.
const REFUSAL_FALLBACK: Pick<Anthropic.Beta.MessageCreateParamsNonStreaming, "betas" | "fallbacks"> =
  /^claude-(opus-5|fable-5)/.test(env.anthropicModel)
    ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" }
    : {};

const isToolError = (result: unknown) => typeof result === "object" && result !== null && "error" in result;

const toParam = (m: ChatMessage): Anthropic.Beta.BetaMessageParam =>
  m.images?.length
    ? {
        role: m.role,
        content: [
          ...m.images.map((image) => ({
            type: "image" as const,
            source: { type: "base64" as const, media_type: image.media_type, data: image.data },
          })),
          { type: "text" as const, text: m.content },
        ],
      }
    : { role: m.role, content: m.content };

/**
 * One assistant turn. The web app sends the chat's saved history each time (this service is
 * stateless); Claude calls tools as often as it needs, then answers in text. Proposals
 * (purchases/location forms, follow-up questions) come back alongside the text.
 */
export async function chat(messages: ChatMessage[], user: { name: string }) {
  const history = messages.map(toParam);
  const system = systemPrompt({ userName: user.name, today: jakartaTodayLabel() });
  const used = new Set<string>();
  const actions = new Map<Action["type"], Action>();
  let replies: string[] = [];
  // Web search filters its results in a code-execution container, and Claude may call our tools
  // from inside it; once the API has opened one, every later request must name it.
  let container: string | undefined;

  const answer = (content: Anthropic.Beta.BetaContentBlock[]) => {
    const reply = withSources(content);
    if (!reply) throw new HttpError(502, "The assistant returned an empty answer — please try again");
    return { reply, tools: [...used], actions: [...actions.values()], replies };
  };

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
      if ((block.type === "tool_use" && !isProposal(block.name)) || block.type === "server_tool_use") {
        used.add(block.name);
      }
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
    if (response.stop_reason !== "tool_use" || calls.length === 0) return answer(response.content);

    // Every result goes back in one message, so Claude keeps calling tools in parallel.
    const results = await Promise.all(
      calls.map(async (call): Promise<Anthropic.Beta.BetaToolResultBlockParam> => {
        let result: unknown;
        if (isProposal(call.name)) {
          const read = readProposal(call.name, call.input);
          if ("error" in read) result = read;
          else {
            if (read.action) actions.set(read.action.type, read.action);
            if (read.replies) replies = read.replies;
            result = { shown: "Shown to the owner under your answer. It is NOT saved until they confirm it." };
          }
        } else {
          result = await runTool(call.name, call.input);
        }
        return {
          type: "tool_result",
          tool_use_id: call.id,
          content: JSON.stringify(result),
          is_error: isToolError(result),
        };
      }),
    );

    // Only proposals after a written answer: they render under it, no extra round needed.
    const wrote = response.content.some((b) => b.type === "text" && b.text.trim());
    if (wrote && calls.every((c) => isProposal(c.name)) && results.every((r) => !r.is_error)) {
      return answer(response.content);
    }

    history.push({ role: "assistant", content: response.content });
    history.push({ role: "user", content: results });
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
