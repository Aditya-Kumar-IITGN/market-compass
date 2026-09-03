import type { BacktestResult, Strategy } from "./strategy";

export function exportBacktestCsv(strategy: Strategy, symbol: string, interval: string, r: BacktestResult) {
  const rows = [
    ["entryTime", "entryPrice", "exitTime", "exitPrice", "qty", "pnl", "pnlPct", "reason"],
    ...r.trades.map((t) => [
      new Date(t.entryTime * 1000).toISOString(),
      t.entryPrice, new Date(t.exitTime * 1000).toISOString(),
      t.exitPrice, t.qty, t.pnl.toFixed(4), t.pnlPct.toFixed(4), t.reason,
    ]),
  ];
  const csv = rows.map((r) => r.map((v) => `"${String(v).replaceAll(`"`, `""`)}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${strategy.name.replace(/\s+/g, "_")}_${symbol}_${interval}_trades.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function openBacktestReport(strategy: Strategy, symbol: string, interval: string, r: BacktestResult) {
  const w = window.open("", "_blank", "width=900,height=1000");
  if (!w) return;
  const alpha = r.totalReturnPct - r.buyHoldReturnPct;
  const metric = (l: string, v: string) => `<tr><td>${l}</td><td class="v">${v}</td></tr>`;
  const equity = r.equity;
  const minV = Math.min(...equity.map((p) => p.value));
  const maxV = Math.max(...equity.map((p) => p.value));
  const W = 800, H = 260;
  const path = equity.map((p, i) => {
    const x = (i / (equity.length - 1 || 1)) * W;
    const y = H - ((p.value - minV) / (maxV - minV || 1)) * H;
    return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  const trades = r.trades.map((t) => `<tr>
    <td>${new Date(t.entryTime * 1000).toLocaleString()}</td>
    <td>${t.entryPrice.toFixed(4)}</td>
    <td>${new Date(t.exitTime * 1000).toLocaleString()}</td>
    <td>${t.exitPrice.toFixed(4)}</td>
    <td class="${t.pnl >= 0 ? "up" : "dn"}">${t.pnl.toFixed(2)}</td>
    <td class="${t.pnl >= 0 ? "up" : "dn"}">${t.pnlPct.toFixed(2)}%</td>
    <td>${t.reason}</td>
  </tr>`).join("");
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${strategy.name} — Backtest Report</title>
    <style>
      body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:32px;color:#111;max-width:900px;margin:auto;}
      h1{margin:0 0 4px 0;} .sub{color:#666;margin-bottom:24px;}
      table.m{border-collapse:collapse;width:100%;margin-bottom:24px;}
      table.m td{padding:6px 10px;border-bottom:1px solid #eee;font-size:13px;}
      table.m td.v{text-align:right;font-variant-numeric:tabular-nums;font-weight:600;}
      svg{border:1px solid #eee;border-radius:4px;background:#fafafa;margin-bottom:24px;}
      table.t{border-collapse:collapse;width:100%;font-size:11px;}
      table.t th,table.t td{padding:4px 8px;border-bottom:1px solid #eee;text-align:left;}
      .up{color:#10b981;} .dn{color:#ef4444;}
      @media print{body{padding:0;}}
    </style></head><body>
    <h1>${strategy.name}</h1>
    <div class="sub">${symbol} · ${interval} · Generated ${new Date().toLocaleString()}</div>
    <table class="m">
      ${metric("Total return", r.totalReturnPct.toFixed(2) + "%")}
      ${metric("Buy & Hold", r.buyHoldReturnPct.toFixed(2) + "%")}
      ${metric("Alpha", (alpha >= 0 ? "+" : "") + alpha.toFixed(2) + "%")}
      ${metric("Max drawdown", "-" + r.maxDrawdownPct.toFixed(2) + "%")}
      ${metric("Sharpe", r.sharpe.toFixed(2))}
      ${metric("Profit factor", Number.isFinite(r.profitFactor) ? r.profitFactor.toFixed(2) : "∞")}
      ${metric("Win rate", r.winRate.toFixed(1) + "%")}
      ${metric("Trades", String(r.trades.length))}
      ${metric("Final equity", "$" + r.finalEquity.toLocaleString(undefined, { maximumFractionDigits: 2 }))}
    </table>
    <svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}"><path d="${path}" stroke="#0ea5e9" stroke-width="2" fill="none"/></svg>
    <h3>Trades</h3>
    <table class="t"><thead><tr><th>Entry</th><th>Entry Px</th><th>Exit</th><th>Exit Px</th><th>P&amp;L</th><th>%</th><th>Reason</th></tr></thead><tbody>${trades}</tbody></table>
    <script>setTimeout(()=>window.print(),400)</script>
  </body></html>`);
  w.document.close();
}
