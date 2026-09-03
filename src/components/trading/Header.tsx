import { CandlestickChart, LineChart, AreaChart, BarChart3, Activity, FlaskConical, Bell, Bot, Clock, BookOpen, User, LogOut, LogIn, Moon } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import type { Interval } from "@/lib/market";
import { parseSymbol } from "@/lib/market";
import type { ChartType } from "./Chart";
import { SymbolSearch } from "./SymbolSearch";
import { cn } from "@/lib/utils";
import { useSession } from "@/hooks/useSession";
import { supabase } from "@/integrations/supabase/client";

const INTERVALS: Interval[] = ["1m", "5m", "15m", "30m", "1h", "4h", "1d", "1w"];

interface Props {
  symbol: string;
  interval: Interval;
  chartType: ChartType;
  onSymbol: (s: string) => void;
  onInterval: (i: Interval) => void;
  onChartType: (t: ChartType) => void;
  onOpenStrategy: () => void;
}

const CHART_TYPES: { type: ChartType; icon: typeof CandlestickChart; label: string }[] = [
  { type: "candles", icon: CandlestickChart, label: "Candles" },
  { type: "heikin", icon: Activity, label: "Heikin Ashi" },
  { type: "bars", icon: BarChart3, label: "Bars" },
  { type: "line", icon: LineChart, label: "Line" },
  { type: "area", icon: AreaChart, label: "Area" },
];

export function Header({ symbol, interval, chartType, onSymbol, onInterval, onChartType, onOpenStrategy }: Props) {
  const { provider, symbol: parsedSymbol } = parseSymbol(symbol);
  const base = parsedSymbol.replace(/USDT$|BUSD$|USDC$|BTC$|ETH$/, "");
  const { user } = useSession();
  const [menu, setMenu] = useState(false);

  return (
    <div className="flex items-center gap-1 px-3 h-11 border-b border-border/60 bg-surface/60 backdrop-blur">
      <Link to="/" className="flex items-center gap-2 pr-3 mr-1 border-r border-border/60">
        <div className="w-7 h-7 rounded bg-gradient-to-br from-primary to-primary/40 flex items-center justify-center text-[11px] font-bold text-primary-foreground">Q</div>
        <span className="text-sm font-semibold tracking-wide">QUANT<span className="text-primary">DESK</span></span>
      </Link>

      <div className="flex items-center gap-2 px-2 py-1 rounded bg-surface-2 border border-border/60">
        <span className="text-sm font-semibold tabular">
          {provider === "binance" ? (
            <>{base}<span className="text-muted-foreground">/{parsedSymbol.slice(base.length) || "USDT"}</span></>
          ) : (
            <>{parsedSymbol}</>
          )}
        </span>
        <span className={cn(
          "text-[10px] uppercase",
          provider === "yahoo" ? "text-blue-500/70" : "text-muted-foreground"
        )}>
          {provider}
        </span>
      </div>

      <div className="mx-2"><SymbolSearch onSelect={onSymbol} /></div>

      <div className="mx-2 h-6 w-px bg-border/60" />

      <div className="flex items-center">
        {INTERVALS.map((i) => (
          <button key={i} onClick={() => onInterval(i)}
            className={cn("px-2.5 h-7 text-xs font-medium tabular rounded transition-colors",
              i === interval ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-surface-2")}>
            {i}
          </button>
        ))}
      </div>

      <div className="mx-2 h-6 w-px bg-border/60" />

      <div className="flex items-center gap-0.5">
        {CHART_TYPES.map(({ type, icon: Icon, label }) => (
          <button key={type} onClick={() => onChartType(type)} title={label}
            className={cn("h-7 w-7 flex items-center justify-center rounded transition-colors",
              chartType === type ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-surface-2")}>
            <Icon className="w-4 h-4" />
          </button>
        ))}
      </div>

      <div className="mx-2 h-6 w-px bg-border/60" />

      <button onClick={onOpenStrategy}
        className="h-7 px-2.5 rounded text-xs font-medium flex items-center gap-1.5 bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
        <FlaskConical className="w-3.5 h-3.5" /> Strategy Lab
      </button>

      <div className="ml-auto flex items-center gap-1">
        <NavLink to="/overnight-backtest" icon={Moon} label="Overnight" />
        <div className="mx-1 h-6 w-px bg-border/60" />
        {user && (
          <>
            <NavLink to="/strategies" icon={BookOpen} label="Strategies" />
            <NavLink to="/alerts" icon={Bell} label="Alerts" />
            <NavLink to="/paper" icon={Bot} label="Paper" />
            <NavLink to="/schedules" icon={Clock} label="Schedules" />
          </>
        )}
        {user && <div className="mx-1 h-6 w-px bg-border/60" />}
        {user ? (
          <div className="relative">
            <button onClick={() => setMenu((v) => !v)}
              className="h-7 px-2 rounded text-xs flex items-center gap-1.5 bg-surface-2 hover:bg-surface text-foreground">
              <User className="w-3.5 h-3.5" />
              <span className="max-w-32 truncate">{user.email}</span>
            </button>
            {menu && (
              <div className="absolute right-0 top-8 z-50 w-40 rounded border border-border/60 bg-popover shadow-lg py-1 text-xs">
                <button onClick={async () => { await supabase.auth.signOut(); setMenu(false); }}
                  className="w-full text-left px-3 py-1.5 hover:bg-surface-2 flex items-center gap-2">
                  <LogOut className="w-3.5 h-3.5" /> Sign out
                </button>
              </div>
            )}
          </div>
        ) : (
          <Link to="/auth" className="h-7 px-2.5 rounded text-xs bg-primary text-primary-foreground flex items-center gap-1.5">
            <LogIn className="w-3.5 h-3.5" /> Sign in
          </Link>
        )}
      </div>
    </div>
  );
}

function NavLink({ to, icon: Icon, label }: { to: string; icon: typeof Bell; label: string }) {
  return (
    <Link to={to as any}
      className="h-7 px-2 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-surface-2 flex items-center gap-1.5">
      <Icon className="w-3.5 h-3.5" /> {label}
    </Link>
  );
}
