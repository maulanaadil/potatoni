import { GeminiError } from "./gemini.ts";

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** Maps anything thrown while answering into a status + English message for the dashboard. */
export function toHttpError(err: unknown): HttpError {
  if (err instanceof HttpError) return err;
  if (err instanceof GeminiError) {
    if (err.status === 429) return new HttpError(429, "The AI model is out of quota right now — try again in a minute");
    if (err.status === 503) return new HttpError(503, "The AI model is very busy right now — try again in a moment");
    return new HttpError(502, `The AI model had a problem: ${err.message}`);
  }
  if (err instanceof Error && err.name === "TimeoutError") {
    return new HttpError(504, "The AI model took too long to answer — please try again");
  }
  return new HttpError(500, "Something went wrong in the assistant");
}
