from __future__ import annotations

import base64, json, os, re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query, Path, Body, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator, ValidationError
from supabase import create_client, Client

# ------------------------------------------------------------------------------
# Env & Supabase client
# ------------------------------------------------------------------------------
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_ROLE = os.getenv("SUPABASE_SERVICE_ROLE", "")
if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE:
    raise RuntimeError("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE in env.")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE)

# ------------------------------------------------------------------------------
# App & CORS
# ------------------------------------------------------------------------------
app = FastAPI(title="Strategy CRUD API", version="1.0.0")

origins = [o.strip() for o in os.getenv("API_CORS_ORIGINS", "").split(",") if o.strip()]
if origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PATCH", "OPTIONS"],
        allow_headers=["*"],
    )

# ------------------------------------------------------------------------------
# Helpers
# ------------------------------------------------------------------------------
ADDR_RE = re.compile(r"^0x[a-fA-F0-9]{40}$")
TX_RE = re.compile(r"^0x[a-fA-F0-9]{64}$")


def now_utc_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def validate_address(addr: str) -> str:
    if not ADDR_RE.match(addr or ""):
        raise HTTPException(status_code=400, detail="Invalid creator/investor address format.")
    # Normalize to lower for DB consistency
    return addr.lower()


def encode_cursor(created_at_iso: str, row_id: str) -> str:
    payload = json.dumps({"created_at": created_at_iso, "id": row_id})
    return base64.urlsafe_b64encode(payload.encode()).decode()


def decode_cursor(cursor: str) -> Tuple[str, str]:
    try:
        data = json.loads(base64.urlsafe_b64decode(cursor.encode()).decode())
        return data["created_at"], data["id"]
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid cursor")


def clamp_sparkline(equity_curve: Optional[List[Dict[str, Any]]], max_points: int = 50) -> Optional[List[float]]:
    if not equity_curve:
        return None
    n = len(equity_curve)
    if n <= max_points:
        return [float(pt.get("eq")) for pt in equity_curve if "eq" in pt]
    # downsample uniformly
    step = max(1, n // max_points)
    return [float(equity_curve[i]["eq"]) for i in range(0, n, step)][:max_points]


def plan_to_summary(plan: Dict[str, Any]) -> Dict[str, Any]:
    assets = plan.get("universe") or plan.get("universe_list") or []
    cadence = ((plan.get("rebalance") or {}).get("cadence")) or "weekly"
    # Attempt a readable one-liner “crux”
    mode = ((plan.get("weighting") or {}).get("mode")) or "composite"
    overlays = []
    if "gates" in plan:
        if plan["gates"].get("all_of"):
            overlays.append("strict gates")
        if plan["gates"].get("any_of"):
            overlays.append("flex gates")
    crux = f"{mode} weights; {cadence} rebalance" + (f"; {' + '.join(overlays)}" if overlays else "")
    return {"assets": assets, "cadence": cadence, "crux": crux[:90]}

# ------------------------------------------------------------------------------
# Schemas
# ------------------------------------------------------------------------------
class InvestmentCreate(BaseModel):
    strategy_id: str = Field(min_length=1)
    investor_address: str
    amount: float = Field(gt=0)
    tx_hash: Optional[str] = None
    created_at: Optional[str] = None  # optional; server will fill if not provided

    @field_validator("investor_address")
    @classmethod
    def _addr_ok(cls, v):
        if not ADDR_RE.match(v or ""):
            raise ValueError("Invalid investor_address format.")
        return v.lower()

    @field_validator("tx_hash")
    @classmethod
    def _tx_ok(cls, v):
        if v is None:
            return v
        if not TX_RE.match(v or ""):
            raise ValueError("Invalid tx_hash format.")
        return v.lower()


class BacktestStats(BaseModel):
    cagr: Optional[float] = None
    sharpe: Optional[float] = None
    stdev: Optional[float] = None
    max_dd: Optional[float] = None
    win_rate: Optional[float] = None
    period: Optional[Dict[str, Any]] = None

    @field_validator("max_dd")
    @classmethod
    def maxdd_range(cls, v):
        if v is None:
            return v
        if not (-1.0 <= v <= 0.0):
            raise ValueError("max_dd must be in [-1, 0].")
        return v

    @field_validator("win_rate")
    @classmethod
    def winrate_range(cls, v):
        if v is None:
            return v
        if not (0.0 <= v <= 1.0):
            raise ValueError("win_rate must be in [0, 1].")
        return v


class EquityPoint(BaseModel):
    t: str
    eq: float


class StrategyCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    creator_address: str
    plan_json: Dict[str, Any]
    backtest_stats: Optional[BacktestStats] = None
    equity_curve: Optional[List[EquityPoint]] = None
    is_public: bool = True
    status: str = Field(default="active")
    tags: Optional[List[str]] = None
    # 🔽 Persisted and needed by Explore → Invest
    vault_address: Optional[str] = None
    initial_weights: Optional[List[float]] = None
    assets: Optional[List[str]] = None  # expected to be addresses

    @field_validator("creator_address")
    @classmethod
    def _check_addr(cls, v):
        if not ADDR_RE.match(v or ""):
            raise ValueError("Invalid creator_address format.")
        return v.lower()

    @field_validator("vault_address")
    @classmethod
    def _check_vault(cls, v):
        if v is None:
            return v
        if not ADDR_RE.match(v or ""):
            raise ValueError("Invalid vault_address format.")
        return v.lower()

    @field_validator("assets")
    @classmethod
    def _check_assets(cls, v):
        if v is None:
            return v
        if not isinstance(v, list):
            raise ValueError("assets must be a list of 0x addresses.")
        out: List[str] = []
        for s in v:
            if not isinstance(s, str) or not ADDR_RE.match(s or ""):
                raise ValueError(f"Invalid asset address: {s}")
            out.append(s.lower())
        return out

    @field_validator("plan_json")
    @classmethod
    def _check_plan(cls, v):
        # minimal sanity checks
        uni = v.get("universe") or v.get("universe_list")
        if uni is None or not isinstance(uni, list) or not (1 <= len(uni) <= 10):
            raise ValueError("plan_json.universe must be a list with 1..10 tickers.")
        reb = v.get("rebalance", {})
        cad = reb.get("cadence", "weekly")
        if cad not in {"daily", "weekly", "monthly"}:
            raise ValueError("rebalance.cadence must be one of: daily, weekly, monthly.")
        return v


class Strategy(BaseModel):
    id: str
    name: str
    creator_address: str
    plan_json: Dict[str, Any]
    backtest_stats: Optional[Dict[str, Any]] = None
    equity_curve: Optional[List[Dict[str, Any]]] = None
    is_public: bool
    status: str
    tags: Optional[List[str]] = None
    created_at: str
    updated_at: str
    # 🔽 New fields exposed for client Invest flow
    vault_address: Optional[str] = None
    weights: Optional[List[float]] = None
    assets: Optional[List[str]] = None


class StrategyCard(BaseModel):
    id: str
    name: str
    creator_address: str
    plan_summary: Dict[str, Any]
    backtest_stats: Optional[Dict[str, Any]] = None
    spark: Optional[List[float]] = None
    is_public: bool
    tags: Optional[List[str]] = None
    created_at: str


class Page(BaseModel):
    items: List[StrategyCard]
    next_cursor: Optional[str] = None


# ---- Investment response models ----
class StrategyMini(BaseModel):
    id: str
    name: str
    created_at: Optional[str] = None
    status: Optional[str] = None


class InvestmentRow(BaseModel):
    id: str
    strategy_id: str
    investor_address: str
    amount: Optional[float] = None
    tx_hash: Optional[str] = None
    created_at: str
    strategy: Optional[StrategyMini] = None


class InvestmentPage(BaseModel):
    items: List[InvestmentRow]
    next_cursor: Optional[str] = None


# ===================== Query helpers =====================
def _list_investments_by_user(address: str, limit: int, cursor: Optional[str]) -> InvestmentPage:
    addr = validate_address(address)

    # Base query: rows for this investor, newest first
    q = (
        supabase.table("investments")
        .select("*")
        .eq("investor_address", addr)
        .order("created_at", desc=True)
        .order("id", desc=True)
    )

    # Cursor: (created_at < C) OR (created_at = C AND id < I)
    if cursor:
        created_at_iso, row_id = decode_cursor(cursor)
        q = q.or_(f"and(created_at.lt.{created_at_iso}),and(created_at.eq.{created_at_iso},id.lt.{row_id})")

    q = q.limit(limit)
    res = q.execute()
    rows = res.data or []

    # Batch fetch strategy minis (avoid N+1)
    strat_ids = [r["strategy_id"] for r in rows if r.get("strategy_id")]
    minis: Dict[str, StrategyMini] = {}
    if strat_ids:
        sres = (
            supabase.table("strategies")
            .select("id,name,created_at,status")
            .in_("id", strat_ids)
            .execute()
        )
        for r in sres.data or []:
            minis[r["id"]] = StrategyMini(
                id=r["id"],
                name=r.get("name") or "Unnamed Strategy",
                created_at=r.get("created_at"),
                status=r.get("status"),
            )

    # Build response items
    items: List[InvestmentRow] = []
    for r in rows:
        items.append(
            InvestmentRow(
                id=r["id"],
                strategy_id=r["strategy_id"],
                investor_address=r["investor_address"],
                amount=(r.get("amount") if isinstance(r.get("amount"), (int, float)) else None),
                tx_hash=r.get("tx_hash"),
                created_at=r["created_at"],
                strategy=minis.get(r["strategy_id"]),
            )
        )

    next_cursor = None
    if len(rows) == limit:
        last = rows[-1]
        next_cursor = encode_cursor(last["created_at"], last["id"])

    return InvestmentPage(items=items, next_cursor=next_cursor)


# ------------------------------------------------------------------------------
# Endpoints
# ------------------------------------------------------------------------------
@app.get("/v1/investments/by-user/{address}", response_model=InvestmentPage)
def investments_by_user(
    address: str,
    limit: int = Query(50, ge=1, le=100),
    cursor: Optional[str] = Query(None),
):
    """
    Lists a user's investments with minimal embedded strategy info.
    Order: newest first (created_at desc, id desc)
    Cursor: opaque; pass next_cursor to fetch the next page.
    """
    try:
        return _list_investments_by_user(address, limit, cursor)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"DB error: {e}")


@app.post("/v1/strategies", status_code=201)
def create_strategy(
    payload: StrategyCreate,
    idempotency_key: Optional[str] = Header(default=None, alias="Idempotency-Key"),
):
    """
    Create a strategy (server-side only; uses service role).
    In prod, you may enforce SIWE JWT and check payload.creator_address == jwt.addr.
    """
    # Basic size checks
    plan_size = len(json.dumps(payload.plan_json))
    if plan_size > 200_000:
        raise HTTPException(status_code=413, detail="plan_json too large (>200KB).")
    if payload.backtest_stats and len(payload.backtest_stats.model_dump_json()) > 50_000:
        raise HTTPException(status_code=413, detail="backtest_stats too large.")
    if payload.equity_curve and len(payload.equity_curve) > 5000:
        raise HTTPException(status_code=413, detail="equity_curve too long (>5000 points).")

    row = {
        "name": payload.name,
        "creator_address": payload.creator_address.lower(),
        "plan_json": payload.plan_json,
        "backtest_stats": payload.backtest_stats.model_dump() if payload.backtest_stats else None,
        "equity_curve": [ep.model_dump() for ep in payload.equity_curve] if payload.equity_curve else None,
        "is_public": payload.is_public,
        "status": payload.status,
        "tags": payload.tags or [],
        # 🔽 fields needed by Explore → Invest
        "vault_address": payload.vault_address,  # already normalized by validator
        "weights": payload.initial_weights,
        "assets": payload.assets,                # already normalized by validator
    }

    try:
        res = supabase.table("strategies").insert(row).execute()
        if not res.data:
            raise HTTPException(status_code=500, detail="Insert failed.")
        new_id = res.data[0]["id"]
        return {"id": new_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"DB error: {e}")


def _list_public(limit: int, cursor: Optional[str]) -> Page:
    q = (
        supabase.table("strategies")
        .select("*")
        .eq("is_public", True)
        .order("created_at", desc=True)
        .order("id", desc=True)
    )

    if cursor:
        created_at_iso, row_id = decode_cursor(cursor)
        # created_at < cursor_created OR (created_at = cursor_created AND id < cursor_id)
        q = q.or_(f"and(created_at.lt.{created_at_iso}),and(created_at.eq.{created_at_iso},id.lt.{row_id})")

    q = q.limit(limit)
    res = q.execute()
    items_raw = res.data or []

    cards: List[StrategyCard] = []
    for r in items_raw:
        spark = clamp_sparkline(r.get("equity_curve"))
        cards.append(
            StrategyCard(
                id=r["id"],
                name=r["name"],
                creator_address=r["creator_address"],
                plan_summary=plan_to_summary(r.get("plan_json") or {}),
                backtest_stats=r.get("backtest_stats"),
                spark=spark,
                is_public=r.get("is_public", True),
                tags=r.get("tags") or [],
                created_at=r["created_at"],
            )
        )

    next_cursor = None
    if len(items_raw) == limit:
        last = items_raw[-1]
        next_cursor = encode_cursor(last["created_at"], last["id"])

    return Page(items=cards, next_cursor=next_cursor)


@app.get("/v1/strategies/explore", response_model=Page)
def explore_strategies(
    limit: int = Query(20, ge=1, le=50),
    cursor: Optional[str] = Query(None),
):
    """Public strategies only, newest first, cursor-paginated."""
    try:
        return _list_public(limit, cursor)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"DB error: {e}")


def _list_by_user(address: str, limit: int, cursor: Optional[str]) -> Page:
    addr = validate_address(address)
    q = (
        supabase.table("strategies")
        .select("*")
        .eq("creator_address", addr)
        .order("created_at", desc=True)
        .order("id", desc=True)
    )

    if cursor:
        created_at_iso, row_id = decode_cursor(cursor)
        q = q.or_(f"and(created_at.lt.{created_at_iso}),and(created_at.eq.{created_at_iso},id.lt.{row_id})")

    q = q.limit(limit)
    res = q.execute()
    items_raw = res.data or []

    cards: List[StrategyCard] = []
    for r in items_raw:
        spark = clamp_sparkline(r.get("equity_curve"))
        cards.append(
            StrategyCard(
                id=r["id"],
                name=r["name"],
                creator_address=r["creator_address"],
                plan_summary=plan_to_summary(r.get("plan_json") or {}),
                backtest_stats=r.get("backtest_stats"),
                spark=spark,
                is_public=r.get("is_public", True),
                tags=r.get("tags") or [],
                created_at=r["created_at"],
            )
        )

    next_cursor = None
    if len(items_raw) == limit:
        last = items_raw[-1]
        next_cursor = encode_cursor(last["created_at"], last["id"])

    return Page(items=cards, next_cursor=next_cursor)


@app.get("/v1/strategies/by-user/{address}", response_model=Page)
def strategies_by_user(
    address: str = Path(..., description="Creator wallet address (0x...)"),
    limit: int = Query(20, ge=1, le=50),
    cursor: Optional[str] = Query(None),
):
    """
    Lists strategies created by {address}.
    NOTE (prod): if you later enforce SIWE, you can decide whether to include private ones
    only when jwt.addr == address. For now, we return all rows by that creator (since writes
    are server-only and Explore privacy == public flag).
    """
    try:
        return _list_by_user(address, limit, cursor)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"DB error: {e}")


@app.get("/v1/strategies/{strategy_id}", response_model=Strategy)
def get_strategy(strategy_id: str = Path(..., description="Strategy UUID id")):
    try:
        res = supabase.table("strategies").select("*").eq("id", strategy_id).limit(1).execute()
        if not res.data:
            raise HTTPException(status_code=404, detail="Not found")
        r = res.data[0]
        # If you add SIWE & private strategies later, enforce here.
        return Strategy(
            id=r["id"],
            name=r["name"],
            creator_address=r["creator_address"],
            plan_json=r.get("plan_json") or {},
            backtest_stats=r.get("backtest_stats"),
            equity_curve=r.get("equity_curve"),
            is_public=r.get("is_public", True),
            status=r.get("status", "active"),
            tags=r.get("tags") or [],
            created_at=r["created_at"],
            updated_at=r["updated_at"],
            # 🔽 Newly exposed fields for Invest flow
            vault_address=r.get("vault_address"),
            weights=r.get("weights"),
            assets=r.get("assets"),
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"DB error: {e}")


@app.post("/v1/investments", status_code=201)
def create_investment(
    payload: InvestmentCreate,
    idempotency_key: Optional[str] = Header(default=None, alias="Idempotency-Key"),
):
    """
    Records an investment made via a vault deposit.

    Behavior:
    - If tx_hash is provided and already recorded, return the existing row (idempotent).
    - Else, if a row exists for (strategy_id, investor_address), UPDATE it:
        amount := COALESCE(amount, 0) + payload.amount
        tx_hash := payload.tx_hash (can be None)
        created_at := payload.created_at or now
    - Else, INSERT a new row.
    """
    try:
        # 0) Ensure the strategy exists
        sres = (
            supabase.table("strategies")
            .select("id")
            .eq("id", payload.strategy_id)
            .limit(1)
            .execute()
        )
        if not sres.data:
            raise HTTPException(status_code=404, detail="Strategy not found.")

        # 1) Idempotency by tx_hash
        if payload.tx_hash:
            existing_tx = (
                supabase.table("investments")
                .select("id")
                .eq("tx_hash", payload.tx_hash.lower())
                .limit(1)
                .execute()
            )
            if existing_tx.data:
                return {"id": existing_tx.data[0]["id"]}

        # 2) Check if the investor already has a row for this strategy
        existing = (
            supabase.table("investments")
            .select("id, amount")
            .eq("strategy_id", payload.strategy_id)
            .eq("investor_address", payload.investor_address.lower())
            .limit(1)
            .execute()
        )

        now_iso = payload.created_at or now_utc_iso()
        if existing.data:
            # UPDATE existing row: accumulate amount, update tx_hash & created_at
            row_id = existing.data[0]["id"]
            current_amt = existing.data[0].get("amount") or 0.0
            new_amt = float(current_amt) + float(payload.amount)

            ures = (
                supabase.table("investments")
                .update({
                    "amount": new_amt,
                    "tx_hash": (payload.tx_hash.lower() if payload.tx_hash else None),
                    # Per your ask, we also update created_at on each deposit
                    "created_at": now_iso,
                })
                .eq("id", row_id)
                .execute()
            )
            if not ures.data:
                raise HTTPException(status_code=500, detail="Update failed.")
            return {"id": row_id, "updated": True, "amount": new_amt}

        # 3) INSERT new row
        ires = (
            supabase.table("investments")
            .insert({
                "strategy_id": payload.strategy_id,
                "investor_address": payload.investor_address.lower(),
                "amount": float(payload.amount),
                "tx_hash": (payload.tx_hash.lower() if payload.tx_hash else None),
                "created_at": now_iso,
            })
            .execute()
        )
        if not ires.data:
            raise HTTPException(status_code=500, detail="Insert failed.")
        return {"id": ires.data[0]["id"], "created": True}

    except HTTPException:
        raise
    except ValidationError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"DB error: {e}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8080, reload=True)
