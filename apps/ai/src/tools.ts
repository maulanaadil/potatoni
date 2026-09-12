import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { type Query, readOnly } from "./db.ts";
import { addDays, daysBetween, jakartaToday, wib } from "./time.ts";

// The assistant's view of the business. Every tool is a fixed, read-only query: the model
// picks tools and arguments, it never writes SQL. Customer names, emails and phone numbers
// are never returned, so no personal data is sent to the model.

const dayKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
const rangeArgs = {
  from: dayKey.optional().describe("First day (YYYY-MM-DD, WIB). Defaults to 29 days before `to`."),
  to: dayKey.optional().describe("Last day (YYYY-MM-DD, WIB). Defaults to today."),
  location_id: z
    .string()
    .optional()
    .describe('Only this location (id from get_locations), or "none" for records without a location. Omit for all.'),
};
type RangeArgs = { from?: string; to?: string; location_id?: string };

/** WHERE clause for a WIB date range (+ optional location); pushes its values onto `params`. */
function rangeFilter(args: RangeArgs, params: unknown[], dateColumn: string, locationColumn: string) {
  const to = args.to ?? jakartaToday();
  const from = args.from ?? addDays(to, -29);
  params.push(from, to);
  let sql = `${wib(dateColumn)}::date BETWEEN $${params.length - 1}::date AND $${params.length}::date`;
  if (args.location_id === "none") sql += ` AND ${locationColumn} IS NULL`;
  else if (args.location_id) {
    params.push(args.location_id);
    sql += ` AND ${locationColumn} = $${params.length}`;
  }
  return { sql, range: { from, to, location_id: args.location_id ?? "all" } };
}

type LocationRow = {
  id: string;
  name: string;
  address: string | null;
  notes: string | null;
  starts_on: string | null;
  ends_on: string | null;
  is_active: boolean;
  orders: number;
  sales: number;
  purchases: number;
  selling_days: number;
};

/** Mirrors locationStatus() in apps/web/src/lib/services/locations.ts. */
function locationStatus(l: LocationRow, today: string) {
  if (!l.starts_on) return "unscheduled";
  if (l.starts_on > today) return "upcoming";
  if (l.ends_on && l.ends_on < today) return "ended";
  return l.is_active ? "current" : "ended";
}

async function locations(q: Query) {
  const today = jakartaToday();
  const rows = await q<LocationRow>(`
    SELECT l.id, l.name, l.address, l.notes, l."startsOn" AS starts_on, l."endsOn" AS ends_on, l."isActive" AS is_active,
      count(o.id)::int AS orders,
      coalesce(sum(o.total), 0) AS sales,
      count(DISTINCT ${wib(`o."createdAt"`)}::date)::int AS selling_days,
      (SELECT coalesce(sum(p.total), 0) FROM "Purchase" p WHERE p."locationId" = l.id) AS purchases
    FROM "Location" l
    LEFT JOIN "Order" o ON o."locationId" = l.id AND o.status = 'PAID'
    GROUP BY l.id
    ORDER BY l."startsOn" NULLS LAST, l.name`);

  return rows.map((l) => {
    const status = locationStatus(l, today);
    return {
      ...l,
      status,
      days_until_start: status === "upcoming" && l.starts_on ? daysBetween(today, l.starts_on) : undefined,
      days_running: status === "current" && l.starts_on ? daysBetween(l.starts_on, today) + 1 : undefined,
      net: l.sales - l.purchases,
      sales_per_selling_day: l.selling_days ? Math.round(l.sales / l.selling_days) : 0,
    };
  });
}

type ToolDef<Args extends z.ZodObject> = {
  name: string;
  description: string;
  args: Args;
  run: (args: z.infer<Args>) => Promise<unknown>;
};
const defineTool = <Args extends z.ZodObject>(tool: ToolDef<Args>) => tool;

const TOOLS = [
  defineTool({
    name: "get_business_overview",
    description:
      "Start here. Today's date, the current menu with prices (products, sizes, seasonings, paid add-ons, upgrades), all-time sales and stock-purchase totals, customer-list size, voucher campaigns and every location/event. Also flags when there isn't enough sales data yet.",
    args: z.object({}),
    run: () =>
      readOnly(async (q) => {
        const [products, modifiers, [sales], [costs], [customers], [vouchers], spots] = await Promise.all([
          q(`
            SELECT p.name, p.category, p.tagline, p."isActive" AS on_menu,
              coalesce(json_agg(json_build_object('size', v.size, 'grams', v.grams, 'price', v.price, 'best_seller', v."isPopular")
                ORDER BY v."sortOrder") FILTER (WHERE v.id IS NOT NULL), '[]') AS sizes
            FROM "Product" p LEFT JOIN "ProductVariant" v ON v."productId" = p.id
            GROUP BY p.id ORDER BY p."sortOrder", p.name`),
          q(`
            SELECT name, type, price, coalesce("appliesTo"::text, 'ALL') AS applies_to, "isActive" AS on_menu
            FROM "Modifier" ORDER BY type, "sortOrder", name`),
          q<{ paid_orders: number }>(`
            SELECT count(*) FILTER (WHERE status = 'PAID')::int AS paid_orders,
              coalesce(sum(total) FILTER (WHERE status = 'PAID'), 0) AS revenue,
              coalesce(round(avg(total) FILTER (WHERE status = 'PAID')), 0) AS average_ticket,
              coalesce(sum(discount) FILTER (WHERE status = 'PAID'), 0) AS discounts_given,
              count(*) FILTER (WHERE status = 'CANCELLED')::int AS cancelled_orders,
              to_char(min(${wib(`"createdAt"`)}) FILTER (WHERE status = 'PAID'), 'YYYY-MM-DD') AS first_sale,
              to_char(max(${wib(`"createdAt"`)}) FILTER (WHERE status = 'PAID'), 'YYYY-MM-DD') AS last_sale
            FROM "Order"`),
          q(`
            SELECT count(*)::int AS purchases, coalesce(sum(total), 0) AS spent,
              to_char(min(${wib(`"purchasedAt"`)}), 'YYYY-MM-DD') AS first_purchase
            FROM "Purchase"`),
          q(`
            SELECT count(*)::int AS customers,
              count(*) FILTER (WHERE "marketingConsent")::int AS agreed_to_promos
            FROM "Customer"`),
          q(`
            SELECT count(*)::int AS campaigns, count(*) FILTER (WHERE "isActive")::int AS active_campaigns
            FROM "VoucherCampaign"`),
          locations(q),
        ]);

        return {
          today: jakartaToday(),
          currency: "IDR (rupiah, integers)",
          menu: { products, seasonings_addons_upgrades: modifiers },
          all_time_sales: sales,
          all_time_stock_purchases: costs,
          customer_list: customers,
          vouchers,
          locations: spots.map(({ id, name, address, notes, starts_on, ends_on, status, orders, sales }) => ({
            id,
            name,
            address,
            notes,
            starts_on,
            ends_on,
            status,
            orders,
            sales,
          })),
          data_note: sales?.paid_orders
            ? undefined
            : "No paid orders are recorded yet, so there is no sales history. Say so, and base advice on the menu, costs, events and clearly-labelled assumptions.",
        };
      }),
  }),

  defineTool({
    name: "get_sales_report",
    description:
      "Paid sales for a date range: revenue, orders, average ticket, items per order, discounts, QRIS vs cash, cancellations, plus a breakdown by day, week, weekday or hour of day (use weekday/hour to find peak times).",
    args: z.object({
      ...rangeArgs,
      group_by: z.enum(["day", "week", "weekday", "hour"]).default("day").describe("How to break the sales down."),
    }),
    run: (args) =>
      readOnly(async (q) => {
        const params: unknown[] = [];
        const f = rangeFilter(args, params, `o."createdAt"`, `o."locationId"`);
        const paid = `SELECT o.id, o.total, o.discount, o."paymentMethod", ${wib(`o."createdAt"`)} AS at FROM "Order" o WHERE o.status = 'PAID' AND ${f.sql}`;
        const bucket = {
          day: `to_char(at, 'YYYY-MM-DD')`,
          week: `'week of ' || to_char(date_trunc('week', at), 'YYYY-MM-DD')`,
          weekday: `to_char(at, 'ID FMDay')`,
          hour: `to_char(at, 'HH24') || ':00'`,
        }[args.group_by];

        const [[totals], breakdown, [cancelled]] = await Promise.all([
          q<{ orders: number; revenue: number; items_sold: number; selling_days: number }>(
            `WITH o AS (${paid})
            SELECT count(*)::int AS orders,
              coalesce(sum(total), 0) AS revenue,
              coalesce(round(avg(total)), 0) AS average_ticket,
              coalesce(sum(discount), 0) AS discounts_given,
              count(DISTINCT at::date)::int AS selling_days,
              coalesce(sum(total) FILTER (WHERE "paymentMethod" = 'QRIS'), 0) AS qris_revenue,
              coalesce(sum(total) FILTER (WHERE "paymentMethod" = 'CASH'), 0) AS cash_revenue,
              (SELECT coalesce(sum(i.quantity), 0) FROM "OrderItem" i WHERE i."orderId" IN (SELECT id FROM o)) AS items_sold
            FROM o`,
            params,
          ),
          q(
            `WITH o AS (${paid})
            SELECT ${bucket} AS period, count(*)::int AS orders, sum(total) AS revenue, round(avg(total)) AS average_ticket
            FROM o GROUP BY 1 ORDER BY 1`,
            params,
          ),
          q(`SELECT count(*)::int AS orders FROM "Order" o WHERE o.status = 'CANCELLED' AND ${f.sql}`, params),
        ]);

        return {
          range: f.range,
          totals: totals && {
            ...totals,
            items_per_order: totals.orders ? +(totals.items_sold / totals.orders).toFixed(2) : 0,
            revenue_per_selling_day: totals.selling_days ? Math.round(totals.revenue / totals.selling_days) : 0,
          },
          cancelled_orders: cancelled,
          breakdown,
        };
      }),
  }),

  defineTool({
    name: "get_product_performance",
    description:
      "What sells, for a date range: units and revenue per product and size, how often each seasoning/add-on/upgrade is chosen and what the paid extras earn, and the share of portions sold with at least one paid extra (attach rate).",
    args: z.object(rangeArgs),
    run: (args) =>
      readOnly(async (q) => {
        const params: unknown[] = [];
        const f = rangeFilter(args, params, `o."createdAt"`, `o."locationId"`);
        const from = `FROM "OrderItem" i JOIN "Order" o ON o.id = i."orderId" WHERE o.status = 'PAID' AND ${f.sql}`;

        const [items, modifiers, [attach]] = await Promise.all([
          q(
            `SELECT i."productName" AS product, i."variantSize" AS size, sum(i.quantity)::int AS units, sum(i."lineTotal") AS revenue
            ${from} GROUP BY 1, 2 ORDER BY units DESC`,
            params,
          ),
          q(
            `SELECT m->>'name' AS name, m->>'type' AS type, sum(i.quantity)::int AS portions,
              sum((m->>'price')::int * i.quantity) AS revenue
            FROM "OrderItem" i JOIN "Order" o ON o.id = i."orderId"
            CROSS JOIN LATERAL jsonb_array_elements(i.modifiers) AS m
            WHERE o.status = 'PAID' AND ${f.sql}
            GROUP BY 1, 2 ORDER BY portions DESC`,
            params,
          ),
          q<{ portions: number; with_paid_extra: number }>(
            `SELECT coalesce(sum(i.quantity), 0) AS portions,
              coalesce(sum(i.quantity) FILTER (WHERE EXISTS (
                SELECT 1 FROM jsonb_array_elements(i.modifiers) m WHERE m->>'type' IN ('ADDON', 'UPGRADE')
              )), 0) AS with_paid_extra
            ${from}`,
            params,
          ),
        ]);

        return {
          range: f.range,
          products: items,
          seasonings_addons_upgrades: modifiers,
          paid_extra_attach_rate: attach?.portions ? +(attach.with_paid_extra / attach.portions).toFixed(3) : null,
          portions_sold: attach?.portions ?? 0,
        };
      }),
  }),

  defineTool({
    name: "get_locations",
    description:
      "Every spot/event the stall is booked at (school bazaars, campus events…) with dates, notes and status (current, upcoming, ended, unscheduled), days until an upcoming one starts, and how each performed: orders, sales, stock purchases, net and sales per selling day. Use this first for 'what's our next event' questions.",
    args: z.object({
      status: z
        .enum(["current", "upcoming", "ended", "unscheduled"])
        .optional()
        .describe("Only locations with this status."),
    }),
    run: ({ status }) =>
      readOnly(async (q) => {
        const all = await locations(q);
        const next = all
          .filter((l) => l.status === "upcoming")
          .sort((a, b) => (a.starts_on ?? "").localeCompare(b.starts_on ?? ""))[0];
        return {
          today: jakartaToday(),
          next_booked_event: next?.name ?? null,
          locations: status ? all.filter((l) => l.status === status) : all,
        };
      }),
  }),

  defineTool({
    name: "get_costs",
    description:
      "Stock purchases (potatoes, oil, chicken, seasoning…) for a date range, grouped by item with quantity, unit, spend and suppliers, compared with paid sales in the same range to show net (sales − purchases).",
    args: z.object(rangeArgs),
    run: (args) =>
      readOnly(async (q) => {
        const purchaseParams: unknown[] = [];
        const f = rangeFilter(args, purchaseParams, `p."purchasedAt"`, `p."locationId"`);
        const orderParams: unknown[] = [];
        const o = rangeFilter(args, orderParams, `o."createdAt"`, `o."locationId"`);

        const [items, [sales]] = await Promise.all([
          q<{ total: number }>(
            `SELECT p.item, p.unit, sum(p.quantity) AS quantity, sum(p.total) AS total, count(*)::int AS times_bought,
              string_agg(DISTINCT p.supplier, ', ') AS suppliers,
              to_char(max(${wib(`p."purchasedAt"`)}), 'YYYY-MM-DD') AS last_bought
            FROM "Purchase" p WHERE ${f.sql}
            GROUP BY 1, 2 ORDER BY total DESC`,
            purchaseParams,
          ),
          q<{ revenue: number }>(
            `SELECT coalesce(sum(o.total), 0) AS revenue FROM "Order" o WHERE o.status = 'PAID' AND ${o.sql}`,
            orderParams,
          ),
        ]);

        const spent = items.reduce((sum, i) => sum + i.total, 0);
        const revenue = sales?.revenue ?? 0;
        return { range: f.range, spent, sales: revenue, net: revenue - spent, items };
      }),
  }),

  defineTool({
    name: "get_voucher_performance",
    description:
      "Each voucher campaign: discount rules, claim window, quota, whether it's open now, vouchers issued vs redeemed, redemption rate, total discount given and revenue from orders that used a voucher.",
    args: z.object({}),
    run: () =>
      readOnly(async (q) => {
        const today = jakartaToday();
        const rows = await q<{
          is_active: boolean;
          claim_starts_at: string | null;
          claim_ends_at: string | null;
          quota: number | null;
          issued: number;
          redeemed: number;
        }>(`
          SELECT c.name, c.description, c."discountType" AS discount_type, c."discountValue" AS discount_value,
            c."maxDiscount" AS max_discount, c."minSpend" AS min_spend,
            c."claimStartsAt" AS claim_starts_at, c."claimEndsAt" AS claim_ends_at,
            c."validDays" AS valid_days, c.quota, c."isActive" AS is_active,
            count(cl.id) FILTER (WHERE cl.status IN ('ISSUED', 'REDEEMED'))::int AS issued,
            count(cl.id) FILTER (WHERE cl.status = 'REDEEMED')::int AS redeemed,
            count(cl.id) FILTER (WHERE cl.status = 'PENDING')::int AS awaiting_email_code,
            coalesce(sum(o.discount) FILTER (WHERE o.status = 'PAID'), 0) AS discount_given,
            coalesce(sum(o.total) FILTER (WHERE o.status = 'PAID'), 0) AS revenue_with_voucher
          FROM "VoucherCampaign" c
          LEFT JOIN "VoucherClaim" cl ON cl."campaignId" = c.id
          LEFT JOIN "Order" o ON o."voucherClaimId" = cl.id
          GROUP BY c.id ORDER BY c."createdAt" DESC`);

        return {
          today,
          campaigns: rows.map((c) => ({
            ...c,
            claiming: !c.is_active
              ? "switched off"
              : c.claim_starts_at && c.claim_starts_at > today
                ? "not started"
                : c.claim_ends_at && c.claim_ends_at < today
                  ? "ended"
                  : c.quota != null && c.issued >= c.quota
                    ? "sold out"
                    : "open",
            redemption_rate: c.issued ? +(c.redeemed / c.issued).toFixed(3) : null,
          })),
        };
      }),
  }),

  defineTool({
    name: "get_customer_insights",
    description:
      "Aggregate numbers about the customer list built from voucher claims: size, verified emails, how many agreed to receive promos (only those may be messaged), repeat voucher users, and sign-ups per week. No personal details.",
    args: z.object({}),
    run: () =>
      readOnly(async (q) => {
        const [[totals], weekly] = await Promise.all([
          q(`
            SELECT count(*)::int AS customers,
              count(*) FILTER (WHERE "emailVerifiedAt" IS NOT NULL)::int AS verified_email,
              count(*) FILTER (WHERE "marketingConsent")::int AS agreed_to_promos,
              (SELECT count(*)::int FROM (
                SELECT "customerId" FROM "VoucherClaim" WHERE status = 'REDEEMED' GROUP BY 1 HAVING count(*) > 1
              ) repeaters) AS used_more_than_one_voucher
            FROM "Customer"`),
          q(`
            SELECT to_char(date_trunc('week', ${wib(`"createdAt"`)}), 'YYYY-MM-DD') AS week_of, count(*)::int AS new_customers
            FROM "Customer" GROUP BY 1 ORDER BY 1 DESC LIMIT 12`),
        ]);
        return { ...totals, signups_by_week: weekly };
      }),
  }),
];

/**
 * Our read-only tools (run by this service) plus Anthropic's hosted web search, for things
 * outside the database: upcoming bazaars and events in Bandung, competitor prices, trends.
 */
export const tools: Anthropic.Beta.BetaToolUnion[] = [
  ...TOOLS.map((tool): Anthropic.Beta.BetaTool => {
    const schema = z.toJSONSchema(tool.args, { io: "input" }) as Anthropic.Beta.BetaTool.InputSchema;
    delete (schema as Record<string, unknown>).$schema;
    return { name: tool.name, description: tool.description, input_schema: schema };
  }),
  {
    type: "web_search_20260209",
    name: "web_search",
    max_uses: 5,
    user_location: {
      type: "approximate",
      city: "Bandung",
      region: "West Java",
      country: "ID",
      timezone: "Asia/Jakarta",
    },
  },
];

/** Runs a tool the model asked for. Errors go back to the model as data so it can recover. */
export async function runTool(name: string, rawArgs: unknown): Promise<unknown> {
  const tool = TOOLS.find((t) => t.name === name);
  if (!tool) return { error: `There is no tool called ${name}` };
  const args = tool.args.safeParse(rawArgs ?? {});
  if (!args.success) return { error: `Invalid arguments: ${args.error.issues[0]?.message}` };
  try {
    return await tool.run(args.data as never);
  } catch (err) {
    console.error(`[tool] ${name} failed`, err);
    return { error: "Couldn't read that data right now. Tell the user and continue with what you have." };
  }
}
