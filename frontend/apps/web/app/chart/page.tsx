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

export default function ChartPage() {
  const API = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

  const [symbol, setSymbol] = useState("SPY");
  const [tf, setTf] = useState<"30m" | "1d">("30m");
  const [candles, setCandles] = useState<Candle[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setErr(null);

    try {
      const url = `${API}/market/candles?symbol=${encodeURIComponent(symbol)}&tf=${tf}&limit=200`;
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error(`API error: ${res.status}`);

      const data = await res.json();
      setCandles(Array.isArray(data.candles) ? data.candles : []);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load candles");
      setCandles([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Convert timestamps to something plotly can display
  const x = useMemo(() => {
    return candles.map((c) => {
      if (typeof c.timestamp === "number") {
        // Schwab sometimes returns epoch milliseconds
        return new Date(c.timestamp).toISOString();
      }
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
      },
    ] as any[];
  }, [candles, x]);

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

      <div style={{ marginTop: 16 }}>
        <Plot
          data={plotData}
          layout={{
            title: `${symbol} (${tf})`,
            height: 650,
            xaxis: { rangeslider: { visible: false } },
            margin: { l: 50, r: 20, t: 50, b: 40 },
          }}
          style={{ width: "100%" }}
          config={{ displayModeBar: true, responsive: true }}
        />
      </div>
    </main>
  );
}
