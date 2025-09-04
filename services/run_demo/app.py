# services/run_demo/app.py
import os
from typing import Optional, Dict, Any, List

import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# ---- Strict imports (no fallbacks) ----
from services.planner.plan_analyzer import (
    build_plan_json_from_text,
    analyze_features,
)
from services.data.data_layer import load_universe
from services.data.sentiment import fetch_headlines, rolling_sentiment
from engine.engine import Plan
from engine.backtest import run_backtest

# ---------- FastAPI app ----------
app = FastAPI(title="PromptFi Run Demo API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # tighten for prod
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------- Models ----------
class PlanRequest(BaseModel):
    text: str

class BacktestReq(BaseModel):
    plan: Dict[str, Any]
    start: Optional[str] = None
    end: Optional[str] = None
    cp_key: Optional[str] = None
    debug: Optional[bool] = False

# ---------- Helpers ----------
def to_plan_obj(pj: Dict[str, Any]) -> Plan:
    """
    Map plan JSON (from planner) to engine.engine.Plan.
    Adjust field names only if your planner differs; otherwise keep 1:1.
    """
    return Plan(
        regime=pj.get("regime", "spot"),
        direction_bias=pj.get("direction_bias", "neutral"),
        universe=pj.get("universe_list") or pj.get("universe") or ["BTC", "ETH", "SOL"],
        gates=pj["gates"],
        custom_rules=pj.get("custom_rules", []),
        weighting=pj["weighting"],
        rebalance=pj["rebalance"],
        risk=pj["risk"],
        execution=pj.get("execution", {"bands": True, "move_halfway": True}),
        sentiment_cfg=pj.get("sentiment_cfg", {}),
    )

def df_to_equity_curve(ec: pd.DataFrame) -> List[Dict[str, float]]:
    """
    Normalize equity curve DataFrame -> list[{t, equity}]
    Expects an 'equity' column.
    """
    if not isinstance(ec, pd.DataFrame) or "equity" not in ec.columns:
        raise ValueError("Backtest returned unexpected equity curve format.")
    out: List[Dict[str, float]] = []
    for t, v in zip(ec.index, ec["equity"]):
        out.append({"t": str(t), "equity": float(v)})
    return out

# ---------- Endpoints ----------
@app.get("/health")
def health():
    return {"ok": True}

@app.post("/plan")
def plan_endpoint(req: PlanRequest):
    """
    Turn free text into validated plan JSON via your planner, plus analysis
    (assets/features/lookback) for downstream data loading.
    """
    try:
        plan_json = build_plan_json_from_text(req.text)
        analysis = analyze_features(plan_json)  # expects {assets, features, lookback_days}
        return {"plan": plan_json, "analysis": analysis}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/get_headlines")
def get_headlines():
    """
    Convenience endpoint to view news rows used by sentiment.
    Requires CP_AUTH_TOKEN/CRYPTOPANIC_KEY in env, otherwise returns empty.
    """
    token = os.getenv("CP_AUTH_TOKEN") or os.getenv("CRYPTOPANIC_KEY") or ""
    if not token:
        return {"headlines": []}
    try:
        df = fetch_headlines(token)
        if isinstance(df, pd.DataFrame) and not df.empty:
            return {"headlines": df.reset_index(drop=True).to_dict(orient="records")}
        return {"headlines": []}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/backtest")
def backtest_endpoint(req: BacktestReq):
    """
    Backtest the provided plan using OHLCV + (optional) sentiment.
    """
    try:
        # 1) Analyze to know assets + lookback window
        meta = analyze_features(req.plan)
        assets = meta["assets"]
        days = meta["lookback_days"]

        # 2) Load OHLCV
        ohlcv = load_universe(assets, since_days=days)

        # 3) Sentiment (optional, requires token)
        token = (req.cp_key or os.getenv("CP_AUTH_TOKEN") or os.getenv("CRYPTOPANIC_KEY") or "").strip()
        sent = {}
        if token:
            try:
                news = fetch_headlines(token)
                if isinstance(news, pd.DataFrame) and not news.empty:
                    sent = rolling_sentiment(news)
            except Exception as e:
                # Sentiment is optional; proceed without if it fails
                print("Sentiment fetch/score failed:", e)

        # 4) Convert plan JSON to Plan object
        plan_obj = to_plan_obj(req.plan)

        # 5) Run backtest
        ec, stats = run_backtest(plan_obj, ohlcv, sent, start=req.start, end=req.end)

        # 6) Normalize equity curve
        equity_curve = df_to_equity_curve(ec)

        return {"stats": stats, "equity_curve": equity_curve}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# ---------- Local quick test ----------
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("services.run_demo.app:app", host="0.0.0.0", port=8001, reload=True)
