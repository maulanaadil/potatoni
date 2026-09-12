import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "./db";
import type { Session } from "./session";

type LogInput = {
  action: string;
  message: string;
  session: Session | null;
  source: "POS" | "DASHBOARD";
  entityType?: string;
  entityId?: string;
  meta?: Prisma.InputJsonValue;
};

/** Every mutation from POS or dashboard lands here so the owner can audit it. */
// Accepts the shared client or an interactive-transaction client.
export async function logActivity(input: LogInput, tx: Pick<typeof db, "activity"> = db) {
  await tx.activity.create({
    data: {
      action: input.action,
      message: input.message,
      source: input.source,
      entityType: input.entityType,
      entityId: input.entityId,
      meta: input.meta,
      actorId: input.session?.sub,
    },
  });
}
