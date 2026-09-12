import { logActivity } from "@/lib/activity";
import { handler, requireApiSession } from "@/lib/api";
import { jakartaDateKey } from "@/lib/format";
import { listCustomers } from "@/lib/services/vouchers";

const cell = (v: string | number | boolean) => {
  const s = String(v);
  // Quote everything; neutralise spreadsheet formulas (=, +, -, @) in user-typed fields.
  return `"${(/^[=+\-@]/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"`;
};

// CSV for email/WhatsApp blasts. Defaults to people who agreed to promos (?all=1 for everyone).
export const GET = handler(async (request) => {
  const session = await requireApiSession("ADMIN");
  const all = new URL(request.url).searchParams.get("all") === "1";
  const customers = await listCustomers({ consentOnly: !all });
  const header = ["Name", "Email", "WhatsApp", "WhatsApp link", "Email verified", "Agreed to promos", "Vouchers", "Used", "Campaigns", "Joined"];
  const rows = customers.map((c) => [
    c.name,
    c.email,
    c.phone,
    `https://wa.me/${c.phone.replace(/\D/g, "")}`,
    c.verified ? "yes" : "no",
    c.marketingConsent ? "yes" : "no",
    c.vouchers,
    c.used,
    c.campaigns.join("; "),
    c.createdAt.slice(0, 10),
  ]);
  const csv = "﻿" + [header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n");
  await logActivity({
    action: "customer.exported",
    message: `${session.name} exported ${customers.length} ${all ? "customers" : "customers who agreed to promos"}`,
    source: "DASHBOARD",
    session,
  });
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="potatoni-customers-${all ? "all" : "promo-ok"}-${jakartaDateKey()}.csv"`,
      "Cache-Control": "no-store",
    },
  });
});
