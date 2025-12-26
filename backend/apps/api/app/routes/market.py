from fastapi import APIRouter, HTTPException, Query
from app.services.schwab_client import get_schwab_client

router = APIRouter(prefix="/market", tags=["market"])


@router.get("/schwab-status")
def schwab_status():
    c = get_schwab_client()
    if c is None:
        raise HTTPException(status_code=401, detail="No Schwab token found.")
    resp = c.get_quote("SPY")
    return {"ok": resp.status_code == 200, "status_code": resp.status_code}


@router.get("/candles")
def candles(
    symbol: str = Query("SPY"),
    tf: str = Query("30m"),     # "30m" or "1d"
    limit: int = Query(200, ge=10, le=500),
):
    """
    Returns candle data from Schwab price history.
    """
    c = get_schwab_client()
    if c is None:
        raise HTTPException(status_code=401, detail="Schwab client not ready.")

    symbol = symbol.upper()

    try:
        # Map timeframe to Schwab params
        if tf == "1d":
            params = dict(
                period_type="month",
                period=3,
                frequency_type="daily",
                frequency=1,
            )
        elif tf == "30m":
            params = dict(
                period_type="day",
                period=10,
                frequency_type="minute",
                frequency=30,
            )
        else:
            raise HTTPException(status_code=400, detail="tf must be '30m' or '1d'")

        resp = c.get_price_history(symbol, **params)
        if resp.status_code != 200:
            raise HTTPException(status_code=resp.status_code, detail=resp.text)

        data = resp.json()
        candles_raw = data.get("candles", [])

        # Keep only last N candles and convert timestamps to ISO strings
        candles_raw = candles_raw[-limit:]

        candles_out = []
        for row in candles_raw:
            candles_out.append(
                {
                    "timestamp": row["datetime"],  # schwab returns epoch ms OR iso depending on wrapper
                    "open": row["open"],
                    "high": row["high"],
                    "low": row["low"],
                    "close": row["close"],
                    "volume": row.get("volume", 0),
                }
            )

        return {"symbol": symbol, "timeframe": tf, "candles": candles_out}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
