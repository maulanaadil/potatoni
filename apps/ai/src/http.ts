import Anthropic from "@anthropic-ai/sdk";

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function toHttpError(err: unknown): HttpError {
  if (err instanceof HttpError) return err;
  // Most specific subclass first; the SDK has already retried 429 / 5xx / 529.
  if (err instanceof Anthropic.RateLimitError) {
    return new HttpError(429, "The assistant is getting too many requests — try again in a minute");
  }
  if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
    return new HttpError(500, "The assistant's Claude API key isn't valid — check ANTHROPIC_API_KEY");
  }
  if (err instanceof Anthropic.APIConnectionTimeoutError) {
    return new HttpError(504, "Claude took too long to answer — please try again");
  }
  if (err instanceof Anthropic.APIConnectionError) {
    return new HttpError(502, "Can't reach Claude right now — check the server's internet connection");
  }
  if (err instanceof Anthropic.APIError) {
    if (err.status === 529 || err.status === 503) {
      return new HttpError(503, "Claude is overloaded right now — try again in a moment");
    }
    return new HttpError(502, `Claude had a problem: ${err.message}`);
  }
  return new HttpError(500, "Something went wrong in the assistant");
}
