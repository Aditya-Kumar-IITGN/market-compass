import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { fetchMarketKlines } from "@/lib/market";

async function ensureAccount(supabase: ReturnType<typeof createServerFn> extends never ? never : any, userId: string) {
  const { data } = await supabase.from("paper_accounts").select("*").eq("user_id", userId).maybeSingle();
  if (data) return data;
  const { data: created, error } = await supabase
    .from("paper_accounts").insert({ user_id: userId, name: "Default", cash: 100000 }).select().single();
  if (error) throw error;
  return created;
}

export const getPaperState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const account = await ensureAccount(context.supabase, context.userId);
    const [orders, positions, bots] = await Promise.all([
      context.supabase.from("paper_orders").select("*").eq("account_id", account.id).order("created_at", { ascending: false }).limit(200),
      context.supabase.from("paper_positions").select("*").eq("account_id", account.id),
      context.supabase.from("paper_bots").select("*").eq("account_id", account.id).order("created_at", { ascending: false }),
    ]);
    return { account, orders: orders.data ?? [], positions: positions.data ?? [], bots: bots.data ?? [] };
  });

export const placePaperOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      symbol: z.string().min(1).max(20),
      side: z.enum(["buy", "sell"]),
      qty: z.number().positive().max(1e9),
    }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const account = await ensureAccount(context.supabase, context.userId);
    const candles = await fetchMarketKlines(data.symbol, "1m", 2);
    const price = candles[candles.length - 1]?.close;
    if (!price) throw new Error("No price available for symbol");
    return await settleOrder(context.supabase, context.userId, account.id, {
      ...data, price, source: "manual", strategyId: null,
    });
  });

export async function settleOrder(
  supabase: any, userId: string, accountId: string,
  o: { symbol: string; side: "buy" | "sell"; qty: number; price: number; source: "manual" | "auto"; strategyId: string | null },
) {
  const notional = o.qty * o.price;
  const { data: pos } = await supabase
    .from("paper_positions").select("*").eq("account_id", accountId).eq("symbol", o.symbol).maybeSingle();
  const { data: acct } = await supabase.from("paper_accounts").select("cash").eq("id", accountId).single();
  let cash = Number(acct!.cash);

  if (o.side === "buy") {
    if (cash < notional) throw new Error("Insufficient cash");
    cash -= notional;
    const newQty = Number(pos?.qty ?? 0) + o.qty;
    const newAvg = pos ? (Number(pos.qty) * Number(pos.avg_price) + notional) / newQty : o.price;
    if (pos) {
      await supabase.from("paper_positions").update({ qty: newQty, avg_price: newAvg }).eq("id", pos.id);
    } else {
      await supabase.from("paper_positions").insert({
        account_id: accountId, user_id: userId, symbol: o.symbol, qty: newQty, avg_price: newAvg,
      });
    }
  } else {
    const held = Number(pos?.qty ?? 0);
    if (held < o.qty) throw new Error("Insufficient position");
    cash += notional;
    const remaining = held - o.qty;
    if (remaining < 1e-12) {
      if (pos) await supabase.from("paper_positions").delete().eq("id", pos.id);
    } else {
      await supabase.from("paper_positions").update({ qty: remaining }).eq("id", pos!.id);
    }
  }

  await supabase.from("paper_accounts").update({ cash }).eq("id", accountId);
  const { data: order, error } = await supabase.from("paper_orders").insert({
    account_id: accountId, user_id: userId, symbol: o.symbol, side: o.side,
    qty: o.qty, price: o.price, status: "filled", source: o.source, strategy_id: o.strategyId,
  }).select().single();
  if (error) throw error;
  return order;
}

export const createBot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      strategy_id: z.string().uuid(),
      symbol: z.string(),
      interval: z.string(),
    }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const account = await ensureAccount(context.supabase, context.userId);
    const { data: row, error } = await context.supabase.from("paper_bots").insert({
      user_id: context.userId, account_id: account.id,
      strategy_id: data.strategy_id, symbol: data.symbol, interval: data.interval, enabled: true,
    }).select().single();
    if (error) throw error;
    return row;
  });

export const toggleBot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), enabled: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("paper_bots").update({ enabled: data.enabled }).eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const deleteBot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("paper_bots").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });
