import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { getSession } from "./auth";
import { isDroppedConnection } from "./db";
import type { Role, Session } from "./session";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function requireApiSession(role?: Role): Promise<Session> {
  const session = await getSession();
  if (!session) throw new HttpError(401, "Please sign in first");
  if (role === "ADMIN" && session.role !== "ADMIN") {
    throw new HttpError(403, "Admins only");
  }
  return session;
}

export async function parseBody<T extends z.ZodType>(request: Request, schema: T) {
  const json = await request.json().catch(() => {
    throw new HttpError(400, "Request body must be JSON");
  });
  const result = schema.safeParse(json);
  if (!result.success) {
    throw new HttpError(400, result.error.issues[0]?.message ?? "Invalid data");
  }
  return result.data as z.infer<T>;
}

/** Wraps a route handler so thrown HttpErrors / Prisma errors become JSON responses. */
export function handler<Ctx>(fn: (request: Request, ctx: Ctx) => Promise<Response>) {
  return async (request: Request, ctx: Ctx) => {
    try {
      return await fn(request, ctx);
    } catch (err) {
      if (err instanceof HttpError) {
        return NextResponse.json({ error: err.message }, { status: err.status });
      }
      if (err instanceof Prisma.PrismaClientKnownRequestError) {
        if (err.code === "P2025") {
          return NextResponse.json({ error: "Not found" }, { status: 404 });
        }
        if (err.code === "P2002") {
          return NextResponse.json({ error: "Already exists" }, { status: 409 });
        }
      }
      if (isDroppedConnection(err)) {
        // Reads already retried once in db.ts; writes are never retried, so let the cashier retry.
        return NextResponse.json(
          { error: "Lost connection to the database — please try again" },
          { status: 503 },
        );
      }
      console.error(err);
      return NextResponse.json({ error: "Something went wrong on the server" }, { status: 500 });
    }
  };
}
