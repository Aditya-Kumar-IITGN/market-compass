import { createFileRoute } from "@tanstack/react-router";
import { fetchMarketKlines } from "@/lib/market";
import { evalRuleAtLast } from "@/lib/rule-eval";
import { settleOrder } from "@/lib/paper.functions";
import type { Strategy } from "@/lib/strategy";

export const Route = createFileRoute("/api/public/cron/run-bots")({
  server: {
    handlers: {
      POST: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: bots } = await supabaseAdmin
          .from("paper_bots").select("*, strategies(definition)").eq("enabled", true);

        let signals = 0;
        for (const b of bots ?? []) {
          try {
            const strat = (b as any).strategies?.definition as Strategy | undefined;
            if (!strat) continue;
            const candles = await fetchMarketKlines(b.symbol, b.interval as any, 300);
            const last = candles[candles.length - 1];
            if (!last || (b.last_bar_time && b.last_bar_time >= last.time)) continue;

            const { data: pos } = await supabaseAdmin
              .from("paper_positions").select("*").eq("account_id", b.account_id).eq("symbol", b.symbol).maybeSingle();
            const hasPos = pos && Number(pos.qty) > 0;

            let action: "buy" | "sell" | null = null;
            if (!hasPos && evalRuleAtLast(strat.entry, candles)) action = "buy";
            else if (hasPos && evalRuleAtLast(strat.exit, candles)) action = "sell";

            if (action) {
              const { data: acct } = await supabaseAdmin.from("paper_accounts").select("cash").eq("id", b.account_id).single();
              let qty = 0;
              if (action === "buy") {
                const spend = Number(acct!.cash) * (strat.positionPct / 100);
                qty = spend / last.close;
              } else {
                qty = Number(pos!.qty);
              }
              if (qty > 0) {
                await settleOrder(supabaseAdmin, b.user_id, b.account_id, {
                  symbol: b.symbol, side: action, qty, price: last.close,
                  source: "auto", strategyId: b.strategy_id,
                });
                signals++;
              }
            }
            await supabaseAdmin.from("paper_bots").update({ last_bar_time: last.time }).eq("id", b.id);
          } catch (e) {
            console.error("bot failed", b.id, e);
          }
        }
        return Response.json({ bots: bots?.length ?? 0, signals });
      },
    },
  },
});
