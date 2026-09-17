import "server-only";
import bcrypt from "bcryptjs";
import { logActivity } from "../activity";
import { HttpError } from "../api";
import { db } from "../db";
import { sendMail } from "../email";
import { inviteEmail } from "../email-templates";
import type { Role, Session } from "../session";
import { hashToken, newToken } from "../tokens";

const INVITE_DAYS = 7;
const RESEND_COOLDOWN_MS = 60_000;
const roleLabel = (role: Role) => (role === "ADMIN" ? "owner" : role === "KITCHEN" ? "kitchen" : "cashier");

const openInvite = { acceptedAt: null, revokedAt: null } as const;

export async function listOpenInvites() {
  return db.invite.findMany({
    where: { ...openInvite },
    include: { invitedBy: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });
}

async function deliver(
  invite: { email: string; name: string | null; role: Role },
  token: string,
  inviterName: string,
  baseUrl: string,
  expiresAt: Date,
) {
  return sendMail({
    to: invite.email,
    ...inviteEmail({
      name: invite.name,
      inviterName,
      role: invite.role,
      link: `${baseUrl}/invite/${token}`,
      expiresAt,
    }),
  });
}

export async function createInvite(
  input: { email: string; name: string | null; role: Role },
  session: Session,
  baseUrl: string,
) {
  if (await db.user.findUnique({ where: { email: input.email } })) {
    throw new HttpError(409, "That email already has an account");
  }
  // A fresh invite replaces any older link sent to the same address.
  await db.invite.updateMany({ where: { email: input.email, ...openInvite }, data: { revokedAt: new Date() } });

  const token = newToken();
  const expiresAt = new Date(Date.now() + INVITE_DAYS * 86_400_000);
  const invite = await db.invite.create({
    data: { ...input, tokenHash: hashToken(token), invitedById: session.sub, expiresAt },
  });

  try {
    const { delivered } = await deliver(invite, token, session.name, baseUrl, expiresAt);
    await logActivity({
      action: "invite.sent",
      message: `${session.name} invited ${input.email} as ${roleLabel(input.role)}`,
      source: "DASHBOARD",
      session,
      entityType: "invite",
      entityId: invite.id,
    });
    // Dev without SMTP: hand the link back so the flow can be tested.
    return { invite, delivered, devLink: delivered ? undefined : `${baseUrl}/invite/${token}` };
  } catch (err) {
    await db.invite.delete({ where: { id: invite.id } });
    throw err;
  }
}

export async function resendInvite(id: string, session: Session, baseUrl: string) {
  const invite = await db.invite.findFirst({ where: { id, ...openInvite } });
  if (!invite) throw new HttpError(404, "This invite was already used or cancelled");
  if (Date.now() - invite.lastSentAt.getTime() < RESEND_COOLDOWN_MS) {
    throw new HttpError(429, "Please wait a minute before sending it again");
  }
  // New token each time, so an older email's link stops working.
  const token = newToken();
  const expiresAt = new Date(Date.now() + INVITE_DAYS * 86_400_000);
  const updated = await db.invite.update({
    where: { id },
    data: { tokenHash: hashToken(token), expiresAt, lastSentAt: new Date() },
  });
  const { delivered } = await deliver(updated, token, session.name, baseUrl, expiresAt);
  await logActivity({
    action: "invite.resent",
    message: `${session.name} re-sent the invite to ${invite.email}`,
    source: "DASHBOARD",
    session,
    entityType: "invite",
    entityId: id,
  });
  return { delivered, devLink: delivered ? undefined : `${baseUrl}/invite/${token}` };
}

export async function revokeInvite(id: string, session: Session) {
  const invite = await db.invite.findFirst({ where: { id, ...openInvite } });
  if (!invite) throw new HttpError(404, "This invite was already used or cancelled");
  await db.invite.update({ where: { id }, data: { revokedAt: new Date() } });
  await logActivity({
    action: "invite.revoked",
    message: `${session.name} cancelled the invite for ${invite.email}`,
    source: "DASHBOARD",
    session,
    entityType: "invite",
    entityId: id,
  });
}

/** A usable invite for this link, or null (unknown, used, cancelled or expired). */
export async function findInviteByToken(token: string) {
  const invite = await db.invite.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { invitedBy: { select: { name: true } } },
  });
  if (!invite || invite.acceptedAt || invite.revokedAt || invite.expiresAt < new Date()) return null;
  return invite;
}

export async function acceptInvite(token: string, input: { name: string; password: string }) {
  const invite = await findInviteByToken(token);
  if (!invite)
    throw new HttpError(410, "This invite link has expired or was already used. Ask the owner for a new one.");
  const passwordHash = await bcrypt.hash(input.password, 12);

  const user = await db.$transaction(async (tx) => {
    if (await tx.user.findUnique({ where: { email: invite.email } })) {
      throw new HttpError(409, "That email already has an account. Sign in instead.");
    }
    // Opening the emailed link is the proof that this address is real.
    const created = await tx.user.create({
      data: { email: invite.email, name: input.name, role: invite.role, passwordHash, emailVerifiedAt: new Date() },
    });
    await tx.invite.update({ where: { id: invite.id }, data: { acceptedAt: new Date() } });
    return created;
  });

  const session: Session = { sub: user.id, name: user.name, email: user.email, role: user.role };
  await logActivity({
    action: "invite.accepted",
    message: `${user.name} joined the team as ${roleLabel(user.role)}`,
    source: user.role === "ADMIN" ? "DASHBOARD" : "POS",
    session,
    entityType: "user",
    entityId: user.id,
  });
  return session;
}
