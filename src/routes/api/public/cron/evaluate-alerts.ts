import { createFileRoute } from "@tanstack/react-router";
import { fetchMarketKlines } from "@/lib/market";
import { evalRuleAtLast } from "@/lib/rule-eval";

export const Route = createFileRoute("/api/public/cron/evaluate-alerts")({
  server: {
    handlers: {
      POST: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: alerts, error } = await supabaseAdmin
          .from("alerts").select("*").eq("enabled", true);
        if (error) return Response.json({ error: error.message }, { status: 500 });

        let fired = 0;
        for (const a of alerts ?? []) {
          try {
            if (a.last_fired_at) {
              const ageSec = (Date.now() - new Date(a.last_fired_at).getTime()) / 1000;
              if (ageSec < a.cooldown_sec) continue;
            }
            const candles = await fetchMarketKlines(a.symbol, a.interval as any, 200);
            if (!evalRuleAtLast(a.rule as any, candles)) continue;
            const price = candles[candles.length - 1].close;
            await supabaseAdmin.from("alert_events").insert({
              user_id: a.user_id, alert_id: a.id, price,
              message: `${a.name} fired on ${a.symbol} ${a.interval} @ ${price}`,
            });
            await supabaseAdmin.from("alerts").update({ last_fired_at: new Date().toISOString() }).eq("id", a.id);
            fired++;
          } catch (e) {
            console.error("alert eval failed", a.id, e);
          }
        }
        return Response.json({ checked: alerts?.length ?? 0, fired });
      },
    },
  },
});
