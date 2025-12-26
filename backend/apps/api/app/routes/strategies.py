from fastapi import APIRouter, HTTPException, Query
from app.services.schwab_client import get_schwab_client

router = APIRouter(prefix="/strategies", tags=["strategies"])


def compute_atr(candles, period=14):
    # ATR = average of true range over N candles
    trs = []
    for i in range(1, len(candles)):
        high = candles[i]["high"]
        low = candles[i]["low"]
        prev_close = candles[i - 1]["close"]
        tr = max(high - low, abs(high - prev_close), abs(low - prev_close))
        trs.append(tr)
    if len(trs) < period:
        return None
    return sum(trs[-period:]) / period


def swing_levels(candles):
    # Swing high = higher than candle before AND after
    # Swing low  = lower than candle before AND after
    swing_highs = []
    swing_lows = []

    for i in range(1, len(candles) - 1):
        prev_c = candles[i - 1]
        cur_c = candles[i]
        next_c = candles[i + 1]

        if cur_c["high"] > prev_c["high"] and cur_c["high"] > next_c["high"]:
            swing_highs.append(cur_c["high"])

        if cur_c["low"] < prev_c["low"] and cur_c["low"] < next_c["low"]:
            swing_lows.append(cur_c["low"])

    last_res = swing_highs[-1] if swing_highs else None
    last_sup = swing_lows[-1] if swing_lows else None
    return last_sup, last_res


def build_trade_ticket(last_close, sup, res, atr, width=5):
    # This produces the "do this trade" box.
    # If price breaks above resistance → bullish → sell PUT spread
    # If price breaks below support → bearish → sell CALL spread
    if sup is None or res is None or atr is None:
        return {"mode": "WAIT", "reason": "Not enough data for levels/ATR yet."}

    if last_close > res:
        short_strike = round(res)
        long_strike = short_strike - width
        stop = short_strike - atr
        return {
            "mode": "BULLISH_BOS",
            "action": "SELL_PUT_SPREAD",
            "short_strike": short_strike,
            "long_strike": long_strike,
            "stop_level": round(stop, 2),
        }

    if last_close < sup:
        short_strike = round(sup)
        long_strike = short_strike + width
        stop = short_strike + atr
        return {
            "mode": "BEARISH_BOS",
            "action": "SELL_CALL_SPREAD",
            "short_strike": short_strike,
            "long_strike": long_strike,
            "stop_level": round(stop, 2),
        }

    return {"mode": "WAIT", "reason": "Price is inside the structure range."}


@router.get("/video-bos")
def video_bos(
    symbol: str = Query("SPY"),
    tf: str = Query("30m"),
    limit: int = Query(200, ge=50, le=500),
):
    c = get_schwab_client()
    if c is None:
        raise HTTPException(status_code=401, detail="Schwab client not ready.")

    symbol = symbol.upper()

    # fetch candles using same rules as your /market/candles
    if tf == "1d":
        params = dict(period_type="month", period=3, frequency_type="daily", frequency=1)
    elif tf == "30m":
        params = dict(period_type="day", period=10, frequency_type="minute", frequency=30)
    else:
        raise HTTPException(status_code=400, detail="tf must be '30m' or '1d'")

    resp = c.get_price_history(symbol, **params)
    if resp.status_code != 200:
        raise HTTPException(status_code=resp.status_code, detail=resp.text)

    raw = resp.json().get("candles", [])[-limit:]

    candles = []
    for row in raw:
        candles.append(
            {
                "timestamp": row["datetime"],
                "open": row["open"],
                "high": row["high"],
                "low": row["low"],
                "close": row["close"],
                "volume": row.get("volume", 0),
            }
        )

    last_close = candles[-1]["close"]
    atr = compute_atr(candles, period=14)
    sup, res = swing_levels(candles)

    ticket = build_trade_ticket(last_close, sup, res, atr, width=5)

    return {
        "symbol": symbol,
        "tf": tf,
        "last_close": last_close,
        "atr14": atr,
        "support": sup,
        "resistance": res,
        "ticket": ticket,
    }
