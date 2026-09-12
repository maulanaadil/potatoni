import "server-only";
import QRCode from "qrcode";
import { Prisma, type VoucherCampaign } from "@/generated/prisma/client";
import { logActivity } from "../activity";
import { HttpError } from "../api";
import { db } from "../db";
import { sendMail } from "../email";
import { claimCodeEmail, voucherEmail } from "../email-templates";
import { formatDay, formatK, formatRupiah, jakartaDateKey } from "../format";
import { hashOtp, newOtp, newVoucherCode, safeEqual } from "../tokens";
import type { CampaignInput } from "../validators";
import { dateKey } from "./locations";

const OTP_TTL_MS = 10 * 60_000;
const MAX_ATTEMPTS = 5;
const MAX_SENDS = 5;
const RESEND_COOLDOWN_MS = 30_000;

type Discountable = Pick<VoucherCampaign, "discountType" | "discountValue" | "maxDiscount" | "minSpend">;

export function discountLabel(c: Discountable) {
  if (c.discountType === "AMOUNT") return `${formatK(c.discountValue)} off`;
  return `${c.discountValue}% off${c.maxDiscount ? ` (up to ${formatK(c.maxDiscount)})` : ""}`;
}

/** Rupiah off this subtotal; 0 when the minimum spend isn't met. Never more than the subtotal. */
export function computeDiscount(c: Discountable, subtotal: number) {
  if (subtotal < c.minSpend) return 0;
  const raw = c.discountType === "PERCENT" ? Math.floor((subtotal * c.discountValue) / 100) : c.discountValue;
  return Math.min(raw, c.maxDiscount ?? Infinity, subtotal);
}

type WindowState = "open" | "inactive" | "not-started" | "ended" | "sold-out";

function claimWindow(c: Pick<VoucherCampaign, "isActive" | "claimStartsAt" | "claimEndsAt">): WindowState {
  const today = jakartaDateKey();
  const start = dateKey(c.claimStartsAt);
  const end = dateKey(c.claimEndsAt);
  if (!c.isActive) return "inactive";
  if (start && start > today) return "not-started";
  if (end && end < today) return "ended";
  return "open";
}

const issuedCount = (campaignId: string) =>
  db.voucherClaim.count({ where: { campaignId, status: { in: ["ISSUED", "REDEEMED"] } } });

async function campaignState(c: VoucherCampaign): Promise<WindowState> {
  const window = claimWindow(c);
  if (window !== "open") return window;
  if (c.quota != null && (await issuedCount(c.id)) >= c.quota) return "sold-out";
  return "open";
}

async function assertClaimable(c: VoucherCampaign) {
  const state = await campaignState(c);
  const messages: Record<Exclude<WindowState, "open">, string> = {
    inactive: "This voucher isn't available any more",
    "not-started": `Claiming opens on ${formatDay(dateKey(c.claimStartsAt))}`,
    ended: "This voucher offer has ended",
    "sold-out": "All vouchers have been claimed. Thanks for stopping by!",
  };
  if (state !== "open") throw new HttpError(410, messages[state]);
}

const maskEmail = (email: string) => {
  const [user = "", domain = ""] = email.split("@");
  return `${user.slice(0, 2)}${"•".repeat(Math.max(1, user.length - 2))}@${domain}`;
};

/* ───────────── Public claim flow ───────────── */

export async function getPublicCampaign(slug: string) {
  const c = await db.voucherCampaign.findUnique({ where: { slug } });
  if (!c) return null;
  const issued = await issuedCount(c.id);
  return {
    slug: c.slug,
    name: c.name,
    description: c.description,
    label: discountLabel(c),
    minSpend: c.minSpend,
    validDays: c.validDays,
    claimEndsOn: dateKey(c.claimEndsAt),
    claimStartsOn: dateKey(c.claimStartsAt),
    state: await campaignState(c),
    remaining: c.quota != null ? Math.max(0, c.quota - issued) : null,
  };
}
export type PublicCampaign = NonNullable<Awaited<ReturnType<typeof getPublicCampaign>>>;

async function sendClaimCode(
  claim: { id: string; otpSentCount: number; otpLastSentAt: Date | null },
  to: { name: string; email: string },
  campaignName: string,
) {
  if (claim.otpLastSentAt && Date.now() - claim.otpLastSentAt.getTime() < RESEND_COOLDOWN_MS) {
    throw new HttpError(429, "Please wait 30 seconds before asking for another code");
  }
  if (claim.otpSentCount >= MAX_SENDS) {
    throw new HttpError(429, "Too many codes sent to this email. Please ask the cashier for help.");
  }
  const otp = newOtp();
  await db.voucherClaim.update({
    where: { id: claim.id },
    data: {
      otpHash: hashOtp(claim.id, otp),
      otpExpiresAt: new Date(Date.now() + OTP_TTL_MS),
      otpAttempts: 0,
      otpSentCount: { increment: 1 },
      otpLastSentAt: new Date(),
    },
  });
  const { delivered } = await sendMail({ to: to.email, ...claimCodeEmail({ name: to.name, code: otp, campaignName }) });
  // Only in development without SMTP: show the code on screen so the flow can be tested.
  return { devCode: delivered ? undefined : otp };
}

export async function startClaim(
  slug: string,
  input: { name: string; email: string; phone: string; marketingConsent: boolean },
  baseUrl: string,
) {
  const campaign = await db.voucherCampaign.findUnique({ where: { slug } });
  if (!campaign) throw new HttpError(404, "Voucher not found");
  await assertClaimable(campaign);

  const phoneTaken = await db.voucherClaim.findFirst({
    where: { campaignId: campaign.id, phone: input.phone, customer: { email: { not: input.email } } },
  });
  if (phoneTaken) throw new HttpError(409, "This WhatsApp number has already claimed this voucher");

  const existing = await db.customer.findUnique({ where: { email: input.email } });
  const consentAt = input.marketingConsent ? (existing?.consentAt ?? new Date()) : null;
  const customer = await db.customer.upsert({
    where: { email: input.email },
    update: { name: input.name, phone: input.phone, marketingConsent: input.marketingConsent, consentAt },
    create: { ...input, consentAt },
  });

  let claim = await db.voucherClaim.findUnique({
    where: { campaignId_customerId: { campaignId: campaign.id, customerId: customer.id } },
  });
  if (claim && claim.status !== "PENDING") {
    // Never show a voucher on screen just for typing an email — send it to that inbox instead.
    if (claim.status === "REDEEMED") throw new HttpError(409, "You've already used this voucher. Thank you!");
    await sendVoucherEmail(claim.id, baseUrl).catch((err) => console.error("[voucher] resend failed", err));
    throw new HttpError(409, "You already have this voucher — we've sent it to your email again.");
  }
  if (!claim) {
    claim = await db.voucherClaim.create({
      data: { campaignId: campaign.id, customerId: customer.id, phone: input.phone },
    });
  } else if (claim.phone !== input.phone) {
    claim = await db.voucherClaim.update({ where: { id: claim.id }, data: { phone: input.phone } });
  }

  const { devCode } = await sendClaimCode(claim, customer, campaign.name);
  return { claimId: claim.id, email: maskEmail(customer.email), devCode };
}

export async function resendClaimCode(claimId: string) {
  const claim = await db.voucherClaim.findUnique({
    where: { id: claimId },
    include: { customer: true, campaign: true },
  });
  if (claim?.status !== "PENDING") throw new HttpError(404, "Start again from the voucher page");
  const { devCode } = await sendClaimCode(claim, claim.customer, claim.campaign.name);
  return { email: maskEmail(claim.customer.email), devCode };
}

export async function verifyClaim(claimId: string, code: string, baseUrl: string) {
  const claim = await db.voucherClaim.findUnique({
    where: { id: claimId },
    include: { campaign: true, customer: true },
  });
  if (!claim) throw new HttpError(404, "Start again from the voucher page");
  if (claim.status !== "PENDING") throw new HttpError(409, "This voucher is already verified — check your email.");
  if (!claim.otpHash || !claim.otpExpiresAt) throw new HttpError(400, "Ask for a code first");
  if (claim.otpAttempts >= MAX_ATTEMPTS) throw new HttpError(429, "Too many wrong codes. Tap “Send a new code”.");
  if (claim.otpExpiresAt < new Date()) throw new HttpError(400, "That code has expired. Tap “Send a new code”.");
  if (!safeEqual(hashOtp(claim.id, code), claim.otpHash)) {
    await db.voucherClaim.update({ where: { id: claim.id }, data: { otpAttempts: { increment: 1 } } });
    const left = MAX_ATTEMPTS - claim.otpAttempts - 1;
    throw new HttpError(
      400,
      left > 0
        ? `That code isn't right. ${left} ${left === 1 ? "try" : "tries"} left.`
        : "Too many wrong codes. Tap “Send a new code”.",
    );
  }
  await assertClaimable(claim.campaign);

  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + claim.campaign.validDays * 86_400_000);
  for (let attempt = 0; ; attempt++) {
    try {
      const updated = await db.voucherClaim.updateMany({
        where: { id: claim.id, status: "PENDING" },
        data: { status: "ISSUED", code: newVoucherCode(), issuedAt, expiresAt, otpHash: null, otpExpiresAt: null },
      });
      if (updated.count === 0) throw new HttpError(409, "This voucher is already verified — check your email.");
      break;
    } catch (err) {
      const clash = err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
      if (!clash || attempt >= 4) throw err;
    }
  }
  await db.customer.update({
    where: { id: claim.customerId },
    data: { emailVerifiedAt: claim.customer.emailVerifiedAt ?? issuedAt },
  });

  const voucher = await getVoucherByClaim(claim.id);
  await logActivity({
    action: "voucher.issued",
    message: `${claim.customer.name} claimed “${claim.campaign.name}” (${voucher.code})`,
    source: "PUBLIC",
    session: null,
    entityType: "voucher",
    entityId: claim.id,
    meta: { campaignId: claim.campaignId, customerId: claim.customerId, consent: claim.customer.marketingConsent },
  });
  // The voucher is already on screen, so a failed email mustn't undo it.
  await sendVoucherEmail(claim.id, baseUrl).catch((err) => console.error("[voucher] email failed", err));
  return voucher;
}

/* ───────────── Voucher views & email ───────────── */

async function getVoucherByClaim(claimId: string) {
  const claim = await db.voucherClaim.findUniqueOrThrow({
    where: { id: claimId },
    include: { campaign: true, customer: true },
  });
  return toVoucherView(claim);
}

function toVoucherView(claim: Prisma.VoucherClaimGetPayload<{ include: { campaign: true; customer: true } }>) {
  const expired = claim.expiresAt ? claim.expiresAt < new Date() : false;
  return {
    code: claim.code!,
    campaignName: claim.campaign.name,
    label: discountLabel(claim.campaign),
    minSpend: claim.campaign.minSpend,
    customerName: claim.customer.name,
    expiresAt: claim.expiresAt?.toISOString() ?? null,
    redeemedAt: claim.redeemedAt?.toISOString() ?? null,
    status: claim.status === "REDEEMED" ? "used" : expired ? "expired" : "valid",
  } as const;
}
export type VoucherView = ReturnType<typeof toVoucherView>;

export async function getVoucherByCode(code: string) {
  const claim = await db.voucherClaim.findUnique({
    where: { code: code.toUpperCase() },
    include: { campaign: true, customer: true },
  });
  return claim && claim.status !== "PENDING" ? toVoucherView(claim) : null;
}

async function sendVoucherEmail(claimId: string, baseUrl: string) {
  const claim = await db.voucherClaim.findUniqueOrThrow({
    where: { id: claimId },
    include: { campaign: true, customer: true },
  });
  if (!claim.code || !claim.expiresAt) return;
  const qr = await QRCode.toBuffer(claim.code, { margin: 1, width: 360, color: { dark: "#2a2670", light: "#ffffff" } });
  await sendMail({
    to: claim.customer.email,
    ...voucherEmail({
      name: claim.customer.name,
      code: claim.code,
      campaignName: claim.campaign.name,
      discountLabel: discountLabel(claim.campaign),
      minSpend: claim.campaign.minSpend,
      expiresAt: claim.expiresAt,
      link: `${baseUrl}/v/voucher/${claim.code}`,
    }),
    attachments: [{ filename: "voucher-qr.png", content: qr, cid: "voucher-qr" }],
  });
}

/* ───────────── Register ───────────── */

/** Validates a code for this subtotal. `tx` lets order creation run it inside its transaction. */
export async function evaluateVoucher(code: string, subtotal: number, tx: Pick<typeof db, "voucherClaim"> = db) {
  const claim = await tx.voucherClaim.findUnique({
    where: { code: code.trim().toUpperCase() },
    include: { campaign: true, customer: { select: { name: true } }, order: { select: { code: true, status: true } } },
  });
  if (!claim) throw new HttpError(404, "Voucher not found. Check the code and try again.");
  if (claim.status === "REDEEMED") throw new HttpError(409, "This voucher was already used");
  if (claim.status !== "ISSUED") throw new HttpError(409, "This voucher isn't verified yet");
  if (claim.expiresAt && claim.expiresAt < new Date()) {
    throw new HttpError(409, `This voucher expired on ${formatDay(dateKey(claim.expiresAt))}`);
  }
  if (claim.order && claim.order.status === "PENDING") {
    throw new HttpError(409, `This voucher is on unpaid order ${claim.order.code}. Cancel that order to use it here.`);
  }
  if (subtotal < claim.campaign.minSpend) {
    throw new HttpError(409, `This voucher needs a minimum spend of ${formatRupiah(claim.campaign.minSpend)}`);
  }
  return {
    claimId: claim.id,
    code: claim.code!,
    discount: computeDiscount(claim.campaign, subtotal),
    label: discountLabel(claim.campaign),
    campaignName: claim.campaign.name,
    customerName: claim.customer.name,
  };
}

/* ───────────── Dashboard ───────────── */

export async function listCampaigns() {
  const [campaigns, counts, redeemedOrders] = await Promise.all([
    db.voucherCampaign.findMany({ orderBy: { createdAt: "desc" } }),
    db.voucherClaim.groupBy({ by: ["campaignId", "status"], _count: true }),
    db.order.findMany({
      where: { status: "PAID", voucherClaimId: { not: null } },
      select: { discount: true, total: true, voucherClaim: { select: { campaignId: true } } },
    }),
  ]);
  return Promise.all(
    campaigns.map(async (c) => {
      const count = (status: "PENDING" | "ISSUED" | "REDEEMED") =>
        counts.find((x) => x.campaignId === c.id && x.status === status)?._count ?? 0;
      const orders = redeemedOrders.filter((o) => o.voucherClaim?.campaignId === c.id);
      return {
        id: c.id,
        name: c.name,
        slug: c.slug,
        description: c.description,
        discountType: c.discountType,
        discountValue: c.discountValue,
        maxDiscount: c.maxDiscount,
        minSpend: c.minSpend,
        claimStartsOn: dateKey(c.claimStartsAt),
        claimEndsOn: dateKey(c.claimEndsAt),
        validDays: c.validDays,
        quota: c.quota,
        isActive: c.isActive,
        label: discountLabel(c),
        state: await campaignState(c),
        stats: {
          pending: count("PENDING"),
          issued: count("ISSUED"),
          redeemed: count("REDEEMED"),
          discountGiven: orders.reduce((s, o) => s + o.discount, 0),
          sales: orders.reduce((s, o) => s + o.total, 0),
        },
      };
    }),
  );
}
export type CampaignSummary = Awaited<ReturnType<typeof listCampaigns>>[number];

export const campaignData = (input: CampaignInput) => ({
  ...input,
  maxDiscount: input.discountType === "PERCENT" ? input.maxDiscount : null,
});

export async function listCustomers({ q, consentOnly = false }: { q?: string; consentOnly?: boolean } = {}) {
  const customers = await db.customer.findMany({
    where: {
      ...(consentOnly ? { marketingConsent: true } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
              { phone: { contains: q.replace(/\D/g, "") || q } },
            ],
          }
        : {}),
    },
    include: { claims: { select: { status: true, code: true, campaign: { select: { name: true } } } } },
    orderBy: { createdAt: "desc" },
    take: 5000,
  });
  return customers.map((c) => ({
    id: c.id,
    name: c.name,
    email: c.email,
    phone: c.phone,
    verified: Boolean(c.emailVerifiedAt),
    marketingConsent: c.marketingConsent,
    createdAt: c.createdAt.toISOString(),
    vouchers: c.claims.filter((x) => x.status !== "PENDING").length,
    used: c.claims.filter((x) => x.status === "REDEEMED").length,
    campaigns: [...new Set(c.claims.map((x) => x.campaign.name))],
  }));
}
export type CustomerRow = Awaited<ReturnType<typeof listCustomers>>[number];
