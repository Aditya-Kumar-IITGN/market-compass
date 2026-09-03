import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Payload = z.object({
  id: z.string().uuid().optional(),
  strategy_id: z.string().uuid(),
  symbol: z.string(),
  interval: z.string(),
  cadence_minutes: z.number().int().min(1).max(1440),
  enabled: z.boolean().default(true),
});

export const listSchedules = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("backtest_schedules")
      .select("*, strategies(name)")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  });

export const saveSchedule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Payload.parse(d))
  .handler(async ({ data, context }) => {
    const row = { ...data, user_id: context.userId };
    if (data.id) {
      const { id, ...patch } = row;
      const { data: r, error } = await context.supabase
        .from("backtest_schedules").update(patch).eq("id", id!).select().single();
      if (error) throw error;
      return r;
    }
    const { id: _s, ...insert } = row;
    void _s;
    const { data: r, error } = await context.supabase
      .from("backtest_schedules").insert(insert).select().single();
    if (error) throw error;
    return r;
  });

export const deleteSchedule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("backtest_schedules").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const listRuns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("backtest_runs")
      .select("id, symbol, interval, metrics, ran_at, strategy_id, strategies(name)")
      .order("ran_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    return data;
  });
