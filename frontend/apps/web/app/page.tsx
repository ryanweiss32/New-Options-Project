"use client";

import { useEffect, useMemo, useState } from "react";
import Plot from "react-plotly.js";

type Candle = {
  timestamp: string | number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

type TradeTicket =
  | {
      mode: "BULLISH_BOS";
      action: "SELL_PUT_SPREAD";
      short_strike: number;
      long_strike: number;
      stop_level: number;
    }
  | {
      mode: "BEARISH_BOS";
      action: "SELL_CALL_SPREAD";
      short_strike: number;
      long_strike: number;
      stop_level: number;
    }
  | {
      mode: "WAIT";
      reason: string;
    };

type StrategyResponse = {
  symbol: string;
  tf: string;
  last_close: number;
  atr14: number | null;
  support: number | null;
  resistance: number | null;
  ticket: TradeTicket;
};

export default function ChartPage() {
  const API = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

  const [symbol, setSymbol] = useState("SPY");
  const [tf, setTf] = useState<"30m" | "1d">("30m");

  const [candles, setCandles] = useState<Candle[]>([]);
  const [strategy, setStrategy] = useState<StrategyResponse | null>(null);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setErr(null);

    try {
      // 1) Candles
      const candlesUrl = `${API}/market/candles?symbol=${encodeURIComponent(
        symbol
      )}&tf=${tf}&limit=200`;
      const candlesRes = await fetch(candlesUrl, { cache: "no-store" });
      if (!candlesRes.ok) throw new Error(`Candles API error: ${candlesRes.status}`);
      const candlesData = await candlesRes.json();
      const c = Array.isArray(candlesData.candles) ? candlesData.candles : [];
      setCandles(c);

      // 2) Strategy outputs (support/resistance/ATR + ticket)
      const stratUrl = `${API}/strategies/video-bos?symbol=${encodeURIComponent(
        symbol
      )}&tf=${tf}&limit=200`;
      const stratRes = await fetch(stratUrl, { cache: "no-store" });
      if (!stratRes.ok) throw new Error(`Strategy API error: ${stratRes.status}`);
      const stratData = (await stratRes.json()) as StrategyResponse;
      setStrategy(stratData);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load data");
      setCandles([]);
      setStrategy(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Convert timestamps into plotly X-axis values
  const x = useMemo(() => {
    return candles.map((c) => {
      if (typeof c.timestamp === "number") return new Date(c.timestamp).toISOString();
      return c.timestamp;
    });
  }, [candles]);

  const plotData = useMemo(() => {
    return [
      {
        type: "candlestick",
        x,
        open: candles.map((c) => c.open),
        high: candles.map((c) => c.high),
        low: candles.map((c) => c.low),
        close: candles.map((c) => c.close),
        name: "Price",
      },
    ] as any[];
  }, [candles, x]);

  // Draw horizontal overlays for support/resistance/stop
  const shapes = useMemo(() => {
    const s: any[] = [];
    const sup = strategy?.support ?? null;
    const res = strategy?.resistance ?? null;

    if (sup != null) {
      s.push({
        type: "line",
        xref: "paper",
        x0: 0,
        x1: 1,
        yref: "y",
        y0: sup,
        y1: sup,
        line: { dash: "dash", width: 2 },
      });
    }

    if (res != null) {
      s.push({
        type: "line",
        xref: "paper",
        x0: 0,
        x1: 1,
        yref: "y",
        y0: res,
        y1: res,
        line: { dash: "dash", width: 2 },
      });
    }

    // Stop level only if ticket provides it
    const ticket = strategy?.ticket;
    if (ticket && ticket.mode !== "WAIT") {
      s.push({
        type: "line",
        xref: "paper",
        x0: 0,
        x1: 1,
        yref: "y",
        y0: ticket.stop_level,
        y1: ticket.stop_level,
        line: { dash: "dot", width: 2 },
      });
    }

    return s;
  }, [strategy]);

  function TicketBox() {
    const t = strategy?.ticket;
    if (!t) return null;

    const baseStyle: React.CSSProperties = {
      padding: 14,
      borderRadius: 12,
      border: "1px solid #333",
      marginTop: 12,
      maxWidth: 900,
    };

    if (t.mode === "WAIT") {
      return (
        <div style={baseStyle}>
          <div style={{ fontWeight: 800, fontSize: 16 }}>WAIT</div>
          <div style={{ opacity: 0.85, marginTop: 6 }}>{t.reason}</div>
          <div style={{ opacity: 0.7, marginTop: 8 }}>
            Support: {strategy?.support ?? "n/a"} | Resistance:{" "}
            {strategy?.resistance ?? "n/a"} | ATR14: {strategy?.atr14 ?? "n/a"}
          </div>
        </div>
      );
    }

    const title =
      t.action === "SELL_CALL_SPREAD" ? "SELL 1DTE CALL CREDIT SPREAD" : "SELL 1DTE PUT CREDIT SPREAD";

    return (
      <div style={baseStyle}>
        <div style={{ fontWeight: 900, fontSize: 16 }}>{title}</div>

        <div style={{ marginTop: 8, display: "flex", gap: 18, flexWrap: "wrap" }}>
          <div>
            <div style={{ opacity: 0.7, fontSize: 12 }}>Mode</div>
            <div style={{ fontWeight: 700 }}>{t.mode}</div>
          </div>

          <div>
            <div style={{ opacity: 0.7, fontSize: 12 }}>Short Strike</div>
            <div style={{ fontWeight: 700 }}>{t.short_strike}</div>
          </div>

          <div>
            <div style={{ opacity: 0.7, fontSize: 12 }}>Long Strike</div>
            <div style={{ fontWeight: 700 }}>{t.long_strike}</div>
          </div>

          <div>
            <div style={{ opacity: 0.7, fontSize: 12 }}>Stop Level</div>
            <div style={{ fontWeight: 700 }}>{t.stop_level}</div>
          </div>
        </div>

        <div style={{ opacity: 0.75, marginTop: 10 }}>
          Support: {strategy?.support ?? "n/a"} | Resistance: {strategy?.resistance ?? "n/a"} | ATR14:{" "}
          {strategy?.atr14 ?? "n/a"}
        </div>
      </div>
    );
  }

  return (
    <main style={{ padding: 24, fontFamily: "system-ui" }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Chart</h2>

        <input
          value={symbol}
          onChange={(e) => setSymbol(e.target.value.toUpperCase())}
          style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #333" }}
        />

        <select
          value={tf}
          onChange={(e) => setTf(e.target.value as any)}
          style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #333" }}
        >
          <option value="30m">30m</option>
          <option value="1d">1d</option>
        </select>

        <button
          onClick={load}
          style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #333", cursor: "pointer" }}
        >
          {loading ? "Loading..." : "Refresh"}
        </button>

        {err ? <span style={{ color: "tomato" }}>{err}</span> : null}
      </div>

      <TicketBox />

      <div style={{ marginTop: 16 }}>
        <Plot
          data={plotData}
          layout={{
            title: `${symbol} (${tf})`,
            height: 650,
            xaxis: { rangeslider: { visible: false } },
            margin: { l: 50, r: 20, t: 50, b: 40 },
            shapes,
          }}
          style={{ width: "100%" }}
          config={{ displayModeBar: true, responsive: true }}
        />
      </div>
    </main>
  );
}
