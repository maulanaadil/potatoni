import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import type Mail from "nodemailer/lib/mailer";
import { HttpError } from "./api";

let transporter: Transporter | null = null;

export const emailConfigured = () => Boolean(process.env.SMTP_HOST);

function transport() {
  if (!emailConfigured()) return null;
  const port = Number(process.env.SMTP_PORT ?? 587);
  transporter ??= nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : port === 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });
  return transporter;
}

export type OutgoingMail = {
  to: string;
  subject: string;
  html: string;
  text: string;
  attachments?: Mail.Attachment[];
};

/**
 * Sends through SMTP. Without SMTP settings, development prints the email to the terminal
 * (so flows can be tested) and production refuses, so nobody waits for a code that never comes.
 */
export async function sendMail(mail: OutgoingMail): Promise<{ delivered: boolean }> {
  const t = transport();
  if (!t) {
    if (process.env.NODE_ENV === "production") {
      throw new HttpError(503, "Email isn't set up yet. Ask the owner to add the SMTP settings.");
    }
    console.info(
      `\n──── [email:dev] not sent (no SMTP_HOST) ────\nTo: ${mail.to}\nSubject: ${mail.subject}\n\n${mail.text}\n────────────────────────────────────────────\n`,
    );
    return { delivered: false };
  }
  try {
    await t.sendMail({
      from: process.env.MAIL_FROM ?? `Potatoni <${process.env.SMTP_USER}>`,
      ...mail,
    });
  } catch (err) {
    console.error("[email] send failed", err);
    throw new HttpError(502, "We couldn't send the email. Please check the address and try again.");
  }
  return { delivered: true };
}

/** Absolute links in emails: APP_URL when set, otherwise the host the request came in on. */
export function appUrl(request: Request) {
  return (process.env.APP_URL ?? new URL(request.url).origin).replace(/\/$/, "");
}
