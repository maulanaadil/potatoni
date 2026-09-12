import "server-only";
import { formatRupiah } from "./format";

// Email clients need inline styles and tables — this is the one place that isn't Tailwind.
const NAVY = "#2a2670";
const CREAM = "#f8f1e6";
const PAPER = "#fffaf2";
const SUN = "#ffc62b";

const escape = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function layout(title: string, body: string) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)}</title></head>
<body style="margin:0;background:${CREAM};font-family:Nunito,Segoe UI,Helvetica,Arial,sans-serif;color:${NAVY}">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CREAM};padding:24px 12px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:${PAPER};border:2px solid ${NAVY};border-radius:24px">
        <tr><td style="padding:24px 24px 8px;text-align:center">
          <div style="display:inline-block;background:${NAVY};color:${SUN};font-weight:800;font-size:22px;letter-spacing:2px;padding:6px 18px;border-radius:999px">POTATONI</div>
          <div style="font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin-top:8px;color:#5a56a0">Crispy outside, happy inside.</div>
        </td></tr>
        <tr><td style="padding:8px 24px 24px;font-size:16px;line-height:1.5">${body}</td></tr>
      </table>
      <p style="font-size:12px;color:#5a56a0;margin:16px 0 0">Good potato, good mood. · Potatoni, Bandung</p>
    </td></tr>
  </table>
</body></html>`;
}

const button = (href: string, label: string) =>
  `<p style="text-align:center;margin:24px 0"><a href="${href}" style="display:inline-block;background:${SUN};color:${NAVY};border:2px solid ${NAVY};border-radius:16px;padding:14px 28px;font-weight:800;text-decoration:none;font-size:17px">${escape(label)}</a></p>`;

export function inviteEmail(p: { name?: string | null; inviterName: string; role: "ADMIN" | "CASHIER"; link: string; expiresAt: Date }) {
  const role = p.role === "ADMIN" ? "an owner" : "a cashier";
  const expires = p.expiresAt.toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: "Asia/Jakarta" });
  const subject = `${p.inviterName} invited you to the Potatoni team`;
  const hello = p.name ? `Hi ${escape(p.name)},` : "Hi,";
  return {
    subject,
    text: `${p.name ? `Hi ${p.name},` : "Hi,"}\n\n${p.inviterName} invited you to join Potatoni as ${role}.\nSet up your account here (link works until ${expires}):\n${p.link}\n\nIf you weren't expecting this, you can ignore this email.`,
    html: layout(
      subject,
      `<p>${hello}</p><p><strong>${escape(p.inviterName)}</strong> invited you to join Potatoni as <strong>${role}</strong>.</p>
       ${button(p.link, "Join the team")}
       <p style="font-size:14px;color:#5a56a0">This link works until ${expires}. Opening it confirms this email address. If you weren't expecting this, you can ignore this email.</p>
       <p style="font-size:12px;color:#5a56a0;word-break:break-all">${escape(p.link)}</p>`,
    ),
  };
}

export function claimCodeEmail(p: { name: string; code: string; campaignName: string }) {
  const subject = `${p.code} is your Potatoni voucher code`;
  return {
    subject,
    text: `Hi ${p.name},\n\nYour code for "${p.campaignName}" is ${p.code}. It works for 10 minutes.\n\nIf you didn't ask for a Potatoni voucher, you can ignore this email.`,
    html: layout(
      subject,
      `<p>Hi ${escape(p.name)},</p><p>Enter this code to get your <strong>${escape(p.campaignName)}</strong> voucher:</p>
       <p style="text-align:center;margin:24px 0"><span style="display:inline-block;background:${CREAM};border:2px dashed ${NAVY};border-radius:16px;padding:14px 24px;font-size:34px;font-weight:800;letter-spacing:10px">${p.code}</span></p>
       <p style="font-size:14px;color:#5a56a0">The code works for 10 minutes. If you didn't ask for a Potatoni voucher, you can ignore this email.</p>`,
    ),
  };
}

export function voucherEmail(p: {
  name: string;
  code: string;
  campaignName: string;
  discountLabel: string;
  minSpend: number;
  expiresAt: Date;
  link: string;
}) {
  const expires = p.expiresAt.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" });
  const subject = `Your Potatoni voucher: ${p.discountLabel}`;
  const min = p.minSpend > 0 ? ` on orders from ${formatRupiah(p.minSpend)}` : "";
  return {
    subject,
    text: `Hi ${p.name},\n\nHere's your voucher for "${p.campaignName}": ${p.discountLabel}${min}.\nCode: ${p.code}\nValid until ${expires}. Show this code (or the QR) to the cashier.\n\nView it any time: ${p.link}`,
    html: layout(
      subject,
      `<p>Hi ${escape(p.name)}, here's your voucher 🎉</p>
       <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${NAVY};color:${PAPER};border-radius:20px;margin:16px 0">
         <tr><td style="padding:20px;text-align:center">
           <div style="font-size:13px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:${SUN}">${escape(p.campaignName)}</div>
           <div style="font-size:32px;font-weight:800;margin:6px 0">${escape(p.discountLabel)}</div>
           <div style="font-size:14px">${min ? `${escape(min.trim())} · ` : ""}valid until ${expires}</div>
         </td></tr>
         <tr><td style="padding:0 20px 20px;text-align:center">
           <img src="cid:voucher-qr" width="180" height="180" alt="Voucher QR code" style="background:#fff;border-radius:12px;padding:8px">
           <div style="font-size:26px;font-weight:800;letter-spacing:3px;margin-top:8px;color:${SUN}">${p.code}</div>
         </td></tr>
       </table>
       <p>Show this code or QR to the cashier when you order.</p>
       ${button(p.link, "Open my voucher")}`,
    ),
  };
}
