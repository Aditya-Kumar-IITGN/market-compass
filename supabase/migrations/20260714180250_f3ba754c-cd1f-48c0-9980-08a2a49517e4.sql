
-- updated_at helper
CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- strategies
CREATE TABLE public.strategies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  symbol text NOT NULL DEFAULT 'BTCUSDT',
  interval text NOT NULL DEFAULT '1h',
  definition jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.strategies TO authenticated;
GRANT ALL ON public.strategies TO service_role;
ALTER TABLE public.strategies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own strategies" ON public.strategies FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_strategies_updated BEFORE UPDATE ON public.strategies
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- backtest_runs
CREATE TABLE public.backtest_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  strategy_id uuid REFERENCES public.strategies(id) ON DELETE SET NULL,
  symbol text NOT NULL,
  interval text NOT NULL,
  metrics jsonb NOT NULL,
  equity jsonb NOT NULL,
  trades jsonb NOT NULL,
  ran_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.backtest_runs TO authenticated;
GRANT ALL ON public.backtest_runs TO service_role;
ALTER TABLE public.backtest_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own runs" ON public.backtest_runs FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- backtest_schedules
CREATE TABLE public.backtest_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  strategy_id uuid NOT NULL REFERENCES public.strategies(id) ON DELETE CASCADE,
  symbol text NOT NULL,
  interval text NOT NULL,
  cadence_minutes integer NOT NULL DEFAULT 60,
  enabled boolean NOT NULL DEFAULT true,
  last_run_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.backtest_schedules TO authenticated;
GRANT ALL ON public.backtest_schedules TO service_role;
ALTER TABLE public.backtest_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own schedules" ON public.backtest_schedules FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_schedules_updated BEFORE UPDATE ON public.backtest_schedules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- alerts
CREATE TABLE public.alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  symbol text NOT NULL,
  interval text NOT NULL DEFAULT '1h',
  rule jsonb NOT NULL,
  channels text[] NOT NULL DEFAULT ARRAY['toast']::text[],
  cooldown_sec integer NOT NULL DEFAULT 300,
  enabled boolean NOT NULL DEFAULT true,
  last_fired_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.alerts TO authenticated;
GRANT ALL ON public.alerts TO service_role;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own alerts" ON public.alerts FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_alerts_updated BEFORE UPDATE ON public.alerts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- alert_events
CREATE TABLE public.alert_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  alert_id uuid NOT NULL REFERENCES public.alerts(id) ON DELETE CASCADE,
  price numeric NOT NULL,
  message text NOT NULL,
  fired_at timestamptz NOT NULL DEFAULT now(),
  seen boolean NOT NULL DEFAULT false
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.alert_events TO authenticated;
GRANT ALL ON public.alert_events TO service_role;
ALTER TABLE public.alert_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own events" ON public.alert_events FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX ON public.alert_events (user_id, fired_at DESC);

-- paper_accounts
CREATE TABLE public.paper_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Default',
  cash numeric NOT NULL DEFAULT 100000,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.paper_accounts TO authenticated;
GRANT ALL ON public.paper_accounts TO service_role;
ALTER TABLE public.paper_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own accounts" ON public.paper_accounts FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- paper_positions
CREATE TABLE public.paper_positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.paper_accounts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  symbol text NOT NULL,
  qty numeric NOT NULL DEFAULT 0,
  avg_price numeric NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, symbol)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.paper_positions TO authenticated;
GRANT ALL ON public.paper_positions TO service_role;
ALTER TABLE public.paper_positions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own positions" ON public.paper_positions FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_pos_updated BEFORE UPDATE ON public.paper_positions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- paper_orders
CREATE TABLE public.paper_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.paper_accounts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  symbol text NOT NULL,
  side text NOT NULL CHECK (side IN ('buy','sell')),
  qty numeric NOT NULL,
  price numeric NOT NULL,
  status text NOT NULL DEFAULT 'filled',
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','auto')),
  strategy_id uuid REFERENCES public.strategies(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.paper_orders TO authenticated;
GRANT ALL ON public.paper_orders TO service_role;
ALTER TABLE public.paper_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own orders" ON public.paper_orders FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX ON public.paper_orders (user_id, created_at DESC);

-- paper_bots
CREATE TABLE public.paper_bots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.paper_accounts(id) ON DELETE CASCADE,
  strategy_id uuid NOT NULL REFERENCES public.strategies(id) ON DELETE CASCADE,
  symbol text NOT NULL,
  interval text NOT NULL DEFAULT '1h',
  enabled boolean NOT NULL DEFAULT true,
  last_bar_time bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.paper_bots TO authenticated;
GRANT ALL ON public.paper_bots TO service_role;
ALTER TABLE public.paper_bots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own bots" ON public.paper_bots FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_bots_updated BEFORE UPDATE ON public.paper_bots
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- push_subscriptions (for future browser push)
CREATE TABLE public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own push" ON public.push_subscriptions FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- pg_cron + pg_net for scheduled endpoints
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
