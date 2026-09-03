import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const StrategyPayload = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(100),
  symbol: z.string().min(1).max(20),
  interval: z.string().min(1).max(10),
  definition: z.any(),
});

export const listStrategies = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("strategies").select("*").order("updated_at", { ascending: false });
    if (error) throw error;
    return data;
  });

export const saveStrategy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => StrategyPayload.parse(d))
  .handler(async ({ data, context }) => {
    const row = {
      user_id: context.userId,
      name: data.name,
      symbol: data.symbol,
      interval: data.interval,
      definition: data.definition,
    };
    if (data.id) {
      const { data: r, error } = await context.supabase
        .from("strategies").update(row).eq("id", data.id).select().single();
      if (error) throw error;
      return r;
    }
    const { data: r, error } = await context.supabase
      .from("strategies").insert(row).select().single();
    if (error) throw error;
    return r;
  });

export const deleteStrategy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("strategies").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });
