import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const AlertPayload = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(100),
  symbol: z.string().min(1).max(20),
  interval: z.string().min(1).max(10),
  rule: z.any(),
  channels: z.array(z.enum(["toast", "push", "email"])).min(1),
  cooldown_sec: z.number().int().min(0).max(86400).default(300),
  enabled: z.boolean().default(true),
});

export const listAlerts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("alerts").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  });

export const saveAlert = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => AlertPayload.parse(d))
  .handler(async ({ data, context }) => {
    const row = {
      user_id: context.userId,
      name: data.name,
      symbol: data.symbol,
      interval: data.interval,
      rule: data.rule,
      channels: data.channels,
      cooldown_sec: data.cooldown_sec,
      enabled: data.enabled,
    };
    if (data.id) {
      const { data: r, error } = await context.supabase
        .from("alerts").update(row).eq("id", data.id).select().single();
      if (error) throw error;
      return r;
    }
    const { data: r, error } = await context.supabase
      .from("alerts").insert(row).select().single();
    if (error) throw error;
    return r;
  });

export const deleteAlert = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("alerts").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const listAlertEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ sinceIso: z.string().optional(), limit: z.number().int().min(1).max(200).default(50) }).parse(d ?? {})
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase.from("alert_events").select("*").order("fired_at", { ascending: false }).limit(data.limit);
    if (data.sinceIso) q = q.gt("fired_at", data.sinceIso);
    const { data: rows, error } = await q;
    if (error) throw error;
    return rows;
  });

export const markEventsSeen = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ ids: z.array(z.string().uuid()) }).parse(d))
  .handler(async ({ data, context }) => {
    if (!data.ids.length) return { ok: true };
    const { error } = await context.supabase.from("alert_events").update({ seen: true }).in("id", data.ids);
    if (error) throw error;
    return { ok: true };
  });
