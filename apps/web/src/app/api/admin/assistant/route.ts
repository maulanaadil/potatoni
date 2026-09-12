import { NextResponse } from "next/server";
import { handler, HttpError, parseBody, requireApiSession } from "@/lib/api";
import { getSessionToken } from "@/lib/auth";
import { assistantInput } from "@/lib/validators";

// Answers can take a few tool calls + model rounds.
const TIMEOUT_MS = 120_000;

/** Proxies the dashboard chat to the assistant service (apps/ai), which re-checks the JWT. */
export const POST = handler(async (request) => {
  await requireApiSession("ADMIN");
  const body = await parseBody(request, assistantInput);
  const token = await getSessionToken();

  const res = await fetch(`${process.env.AI_SERVICE_URL ?? "http://localhost:4000"}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  }).catch((err: unknown) => {
    if (err instanceof Error && err.name === "TimeoutError") {
      throw new HttpError(504, "The assistant took too long to answer — please try again");
    }
    throw new HttpError(503, "The assistant service isn't running (apps/ai)");
  });

  const data = (await res.json().catch(() => ({ error: "The assistant sent an invalid answer" }))) as Record<string, unknown>;
  return NextResponse.json(data, { status: res.status });
});
