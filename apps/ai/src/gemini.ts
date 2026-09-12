import { env } from "./env.ts";

// Minimal REST client for the Gemini API (generateContent), no SDK needed.
// https://ai.google.dev/api/generate-content

export type FunctionCall = { id?: string; name: string; args?: Record<string, unknown> };

export type Part = {
  text?: string;
  thought?: boolean;
  // Gemini's thinking models sign their turns; the model's content must be sent back unchanged.
  thoughtSignature?: string;
  functionCall?: FunctionCall;
  functionResponse?: { id?: string; name: string; response: Record<string, unknown> };
};

export type Content = { role: "user" | "model"; parts: Part[] };

export type FunctionDeclaration = {
  name: string;
  description: string;
  parametersJsonSchema: Record<string, unknown>;
};

type Tool = { functionDeclarations: FunctionDeclaration[] } | { google_search: Record<string, never> };

export type GenerateContentRequest = {
  contents: Content[];
  systemInstruction?: { parts: Part[] };
  tools?: Tool[];
  toolConfig?: { functionCallingConfig: { mode: "AUTO" | "ANY" | "NONE" } };
};

export type Candidate = {
  content?: Content;
  finishReason?: string;
  groundingMetadata?: { groundingChunks?: { web?: { uri: string; title?: string } }[] };
};

type GenerateContentResponse = {
  candidates?: Candidate[];
  promptFeedback?: { blockReason?: string };
};

export class GeminiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";

export async function generateContent(body: GenerateContentRequest): Promise<GenerateContentResponse> {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(`${BASE_URL}/${env.geminiModel}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": env.geminiApiKey },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(90_000),
    });
    if (res.ok) return (await res.json()) as GenerateContentResponse;

    const data = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    // 500/503 mean the model is overloaded ("high demand"); a retry after a short pause usually lands.
    if ((res.status === 500 || res.status === 503) && attempt < 3) {
      await new Promise((resolve) => setTimeout(resolve, attempt * 2000));
      continue;
    }
    throw new GeminiError(res.status, data.error?.message ?? `Gemini answered ${res.status}`);
  }
}

/** The visible answer: text parts without the model's thoughts. */
export const textOf = (content: Content | undefined) =>
  (content?.parts ?? [])
    .filter((p) => p.text && !p.thought)
    .map((p) => p.text)
    .join("")
    .trim();
