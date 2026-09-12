import Anthropic from "@anthropic-ai/sdk";
import { env } from "./env.ts";
import { HttpError } from "./http.ts";
import { systemPrompt } from "./prompt.ts";
import { type Action, isProposal, proposalTools, readProposal } from "./proposals.ts";
import { jakartaTodayLabel } from "./time.ts";
import { tools as dataTools, runTool } from "./tools.ts";

export type ImageInput = { media_type: "image/png" | "image/jpeg" | "image/webp"; data: string };
export type ChatMessage = { role: "user" | "assistant"; content: string; images?: ImageInput[] };

const client = new Anthropic({ apiKey: env.anthropicApiKey });
const tools = [...dataTools, ...proposalTools];
const MAX_ROUNDS = 8;

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

export async function chat({
  messages,
  user,
  instructions,
}: {
  messages: ChatMessage[];
  user: { name: string };
  instructions?: string;
}) {
  const history = messages.map(toParam);
  const system = systemPrompt({ instructions, userName: user.name, today: jakartaTodayLabel() });
  const used = new Set<string>();
  const actions = new Map<Action["type"], Action>();
  let replies: string[] = [];
  // Web search runs in a code-execution container; once opened, every later request must name it.
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

    if (response.stop_reason === "pause_turn") {
      history.push({ role: "assistant", content: response.content });
      continue;
    }

    const calls = response.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
    if (response.stop_reason !== "tool_use" || calls.length === 0) return answer(response.content);

    const results = await Promise.all(
      calls.map(async (call): Promise<Anthropic.Beta.BetaToolResultBlockParam> => {
        const result = isProposal(call.name) ? collect(call) : await runTool(call.name, call.input);
        return {
          type: "tool_result",
          tool_use_id: call.id,
          content: JSON.stringify(result),
          is_error: isToolError(result),
        };
      }),
    );

    // Proposals after a written answer are rendered under it, so no extra round is needed.
    const wrote = response.content.some((b) => b.type === "text" && b.text.trim());
    if (wrote && calls.every((c) => isProposal(c.name)) && results.every((r) => !r.is_error)) {
      return answer(response.content);
    }

    history.push({ role: "assistant", content: response.content });
    history.push({ role: "user", content: results });
  }

  function collect(call: Anthropic.Beta.BetaToolUseBlock) {
    const read = readProposal(call.name, call.input);
    if ("error" in read) return read;
    if (read.action) actions.set(read.action.type, read.action);
    if (read.replies) replies = read.replies;
    return { shown: "Shown to the owner under your answer. It is NOT saved until they confirm it." };
  }
}

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
