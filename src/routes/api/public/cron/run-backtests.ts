import { createFileRoute } from "@tanstack/react-router";
import { fetchMarketKlines } from "@/lib/market";
import { runBacktest, type Strategy } from "@/lib/strategy";

export const Route = createFileRoute("/api/public/cron/run-backtests")({
  server: {
    handlers: {
      POST: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: schedules } = await supabaseAdmin
          .from("backtest_schedules").select("*, strategies(definition)").eq("enabled", true);

        let ran = 0;
        for (const s of schedules ?? []) {
          try {
            const strat = (s as any).strategies?.definition as Strategy | undefined;
            if (!strat) continue;
            if (s.last_run_at) {
              const age = (Date.now() - new Date(s.last_run_at).getTime()) / 60000;
              if (age < s.cadence_minutes) continue;
            }
            const candles = await fetchMarketKlines(s.symbol, s.interval as any, 1000);
            const r = runBacktest(strat, candles);
            const metrics = {
              totalReturnPct: r.totalReturnPct,
              buyHoldReturnPct: r.buyHoldReturnPct,
              winRate: r.winRate,
              sharpe: r.sharpe,
              maxDrawdownPct: r.maxDrawdownPct,
              profitFactor: Number.isFinite(r.profitFactor) ? r.profitFactor : null,
              trades: r.trades.length,
              finalEquity: r.finalEquity,
            };
            await supabaseAdmin.from("backtest_runs").insert({
              user_id: s.user_id, strategy_id: s.strategy_id,
              symbol: s.symbol, interval: s.interval,
              metrics, equity: r.equity as any, trades: r.trades as any,
            });
            await supabaseAdmin.from("backtest_schedules").update({ last_run_at: new Date().toISOString() }).eq("id", s.id);
            ran++;
          } catch (e) {
            console.error("schedule failed", s.id, e);
          }
        }
        return Response.json({ schedules: schedules?.length ?? 0, ran });
      },
    },
  },
});
