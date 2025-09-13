# engine/weights_now.py
from __future__ import annotations
import re, time, math, requests, pandas as pd, numpy as np
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional, Tuple
try:
    import ccxt
except Exception:
    ccxt = None
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer

# =========================
# ---- Config / Defaults ---
# =========================
GOOD_THRESH = 0.30
BAD_THRESH  = -0.30
# You can add "pattern" in plan["weighting"]["coeffs"] to blend pattern_score
COEFFS_DEFAULT = {"trend":0.40, "mom":0.30, "vol":0.20, "sent":0.10}
MAX_LOOKBACK_D = 540
REB_FREQ = "W-FRI"
COINGECKO_IDS = {"BTC":"bitcoin","ETH":"ethereum","SOL":"solana","WAVAX":"avalanche-2"}
STABLECOINS = {"USDT", "USDC", "DAI", "BUSD", "FRAX"}  # Assets to skip price analysis

# ===== Patterns (names lowercased) =====
BULLISH_KEYS = {
    "ascending_triangle", "symmetrical_triangle", "bull_flag",
    "double_bottom", "inverse_head_shoulders", "wedge_falling",
    "engulfing_bull", "hammer"
}
BEARISH_KEYS = {
    "descending_triangle", "bear_flag", "double_top",
    "head_shoulders", "wedge_rising", "engulfing_bear",
    "shooting_star"
}

# =========================
# --------- Utils ---------
# =========================
def _now_utc():
    return datetime.now(timezone.utc)

def _safe_coeffs(plan: Dict) -> Dict[str,float]:
    w = (plan.get("weighting", {}) or {})
    mode = str(w.get("mode","composite")).lower()
    c = (w.get("coeffs") or COEFFS_DEFAULT).copy()
    # if mode explicitly "sentiment", bias to sentiment-only unless user overrode
    if mode == "sentiment" and "sent" not in c and "sentiment" not in c:
        c = {"sent": 1.0}
    # normalize to sum=1
    s = sum(max(0.0, float(v)) for v in c.values()) or 1.0
    return {k: max(0.0, float(v))/s for k,v in c.items()}

def _ema(s: pd.Series, n: int) -> pd.Series:
    return s.ewm(span=n, adjust=False, min_periods=n).mean()

def _sma(s: pd.Series, n: int) -> pd.Series:
    return s.rolling(n, min_periods=n).mean()

def _std(s: pd.Series, n:int) -> pd.Series:
    return s.rolling(n, min_periods=n).std()

def _rsi(s: pd.Series, n:int=14) -> pd.Series:
    d = s.diff()
    up = d.clip(lower=0.0); dn = -d.clip(upper=0.0)
    ma_up = up.ewm(alpha=1/n, min_periods=n, adjust=False).mean()
    ma_dn = dn.ewm(alpha=1/n, min_periods=n, adjust=False).mean()
    rs = ma_up/(ma_dn+1e-12)
    return 100 - (100/(1+rs))

def _rsi14(s: pd.Series) -> pd.Series:
    return _rsi(s, 14)

def _ret_nd(s: pd.Series, n: int) -> pd.Series:
    return s.pct_change(n).fillna(0.0)

def _vol_sma(v: pd.Series, n: int) -> pd.Series:
    return v.rolling(n, min_periods=n).mean()

# ==== Volatility / Trend Strength / Breakout ====
def _true_range(h: pd.Series, l: pd.Series, c: pd.Series) -> pd.Series:
    prev_c = c.shift(1)
    tr = pd.concat([(h-l).abs(), (h-prev_c).abs(), (l-prev_c).abs()], axis=1).max(axis=1)
    return tr

def _atr(h: pd.Series, l: pd.Series, c: pd.Series, n:int) -> pd.Series:
    return _true_range(h,l,c).rolling(n, min_periods=n).mean()

def _donchian_hi(h: pd.Series, n:int) -> pd.Series:
    return h.rolling(n, min_periods=n).max()

def _donchian_lo(l: pd.Series, n:int) -> pd.Series:
    return l.rolling(n, min_periods=n).min()

def _bb(close: pd.Series, n:int, k:float):
    basis = _sma(close, n)
    sd = _std(close, n)
    up = basis + k*sd
    dn = basis - k*sd
    bw_pct = (up - dn) / (basis.replace(0, np.nan)).abs()
    return basis, up, dn, bw_pct

def _kc(close: pd.Series, h: pd.Series, l: pd.Series, n:int, m:float):
    basis = _ema(close, n)
    atr = _atr(h,l,close, n)
    up = basis + m*atr
    dn = basis - m*atr
    return basis, up, dn

def _pos_neg_dm(h: pd.Series, l: pd.Series):
    up_move = h.diff()
    dn_move = -l.diff()
    plus_dm = up_move.where((up_move > dn_move) & (up_move > 0), 0.0)
    minus_dm = dn_move.where((dn_move > up_move) & (dn_move > 0), 0.0)
    return plus_dm, minus_dm

def _adx_di(h: pd.Series, l: pd.Series, c: pd.Series, n:int):
    tr = _true_range(h,l,c).rolling(n, min_periods=n).sum()
    plus_dm, minus_dm = _pos_neg_dm(h,l)
    plus_di = (plus_dm.rolling(n, min_periods=n).sum() / (tr + 1e-12)) * 100
    minus_di = (minus_dm.rolling(n, min_periods=n).sum() / (tr + 1e-12)) * 100
    dx = ( (plus_di - minus_di).abs() / ((plus_di + minus_di)+1e-12) ) * 100
    adx = dx.rolling(n, min_periods=n).mean()
    return adx, plus_di, minus_di

# ==== Momentum / Volume ====
def _macd(close: pd.Series, fast:int, slow:int, signal:int):
    macd_line = _ema(close, fast) - _ema(close, slow)
    signal_line = macd_line.ewm(span=signal, adjust=False, min_periods=signal).mean()
    hist = macd_line - signal_line
    return macd_line, signal_line, hist

def _obv(close: pd.Series, vol: pd.Series):
    sign = np.sign(close.diff().fillna(0.0))
    return (sign * vol).cumsum()

def _mfi(h: pd.Series, l: pd.Series, c: pd.Series, v: pd.Series, n:int):
    tp = (h + l + c)/3.0
    mf = tp * v
    pos = mf.where(tp > tp.shift(1), 0.0)
    neg = mf.where(tp < tp.shift(1), 0.0)
    pos_sum = pos.rolling(n, min_periods=n).sum()
    neg_sum = neg.rolling(n, min_periods=n).sum()
    mr = pos_sum / (neg_sum + 1e-12)
    return 100 - (100/(1+mr))

def _cmf(h: pd.Series, l: pd.Series, c: pd.Series, v: pd.Series, n:int):
    mfm = ((c - l) - (h - c)) / ((h - l).replace(0, np.nan))
    mfv = mfm * v
    return (mfv.rolling(n, min_periods=n).sum() / (v.rolling(n, min_periods=n).sum() + 1e-12)).fillna(0.0)

def _stoch_rsi(close: pd.Series, rsi_len:int=14, stoch_len:int=14, k:int=3, d:int=3):
    r = _rsi(close, rsi_len)
    r_min = r.rolling(stoch_len, min_periods=stoch_len).min()
    r_max = r.rolling(stoch_len, min_periods=stoch_len).max()
    k_raw = (r - r_min) / ((r_max - r_min) + 1e-12)
    k_line = k_raw.rolling(k, min_periods=k).mean()
    d_line = k_line.rolling(d, min_periods=d).mean()
    return k_line.clip(0,1), d_line.clip(0,1)

def _vwap_daily_anchored(close: pd.Series, vol: pd.Series):
    # daily approximation without H/L: use close as typical price
    cum_v = vol.cumsum().replace(0, np.nan)
    cum_pv = (close * vol).cumsum()
    return (cum_pv / cum_v).fillna(method="ffill").fillna(close)

def _vwap_rolling(close: pd.Series, vol: pd.Series, n:int):
    pv = close * vol
    return (pv.rolling(n, min_periods=n).sum() / (vol.rolling(n, min_periods=n).sum() + 1e-12)).fillna(method="ffill")

# =========================
# ---- Caps & Weights -----
# =========================
def _apply_caps_and_renorm(w: Dict[str,float], max_w: float, hard_cap: float, strict_caps: bool) -> Dict[str,float]:
    if not w:
        return w
    if not strict_caps:
        s = sum(w.values()) or 1.0
        return {k: v/s for k,v in w.items()}
    # strict cap flow
    w = {k: min(v, max_w) for k,v in w.items()}
    s = sum(w.values()) or 1.0
    w = {k: v/s for k,v in w.items()}
    w = {k: min(v, hard_cap) for k,v in w.items()}
    s = sum(w.values()) or 1.0
    return {k: v/s for k,v in w.items()}

def _weights_from_scores(scores: Dict[str, float],
                         max_w: float, hard_cap: float, strict_caps: bool) -> Dict[str,float]:
    pos = {k: max(0.0, float(v)) for k,v in scores.items()}
    if sum(pos.values()) == 0.0:
        w = {k: 1.0/len(pos) for k in pos} if pos else {}
    else:
        tot = sum(pos.values())
        w = {k: v/tot for k,v in pos.items()}
    return _apply_caps_and_renorm(w, max_w, hard_cap, strict_caps)

def _blend_tilt(base_w: Dict[str,float],
                sentiment_now: Dict[str,float],
                tilt: float,
                strict_caps: bool,
                max_w: float,
                hard_cap: float) -> Dict[str,float]:
    if tilt is None or tilt <= 0.0 or not sentiment_now:
        return base_w
    pos = {k: max(0.0, float(v)) for k,v in sentiment_now.items()}
    tot = sum(pos.values())
    if tot == 0:
        return base_w
    s_share = {k: v/tot for k,v in pos.items()}
    keys = set(base_w.keys()) | set(s_share.keys())
    blended = {k: (1.0-tilt)*base_w.get(k,0.0) + tilt*s_share.get(k,0.0) for k in keys}
    return _apply_caps_and_renorm(blended, max_w, hard_cap, strict_caps)

# ===== Pattern helpers =====
def _pattern_score_from_cards(cards: List[dict]) -> float:
    if not cards:
        return 0.0
    bull = 0.0
    bear = 0.0
    for c in cards:
        patt = str(c.get("pattern","")).lower()
        prob = float(c.get("prob", 0.0))
        conf = float(c.get("confidence", 0.0))
        p = max(0.0, min(1.0, prob)) * max(0.0, min(1.0, conf))
        if patt in BULLISH_KEYS:
            bull = max(bull, p)
        elif patt in BEARISH_KEYS:
            bear = max(bear, p)
    return max(0.0, bull - bear)

def _passes_pattern_gate(cards: List[dict], req: dict) -> bool:
    name = str(req.get("name","any")).lower()
    min_prob = float(req.get("min_prob", 0.55))
    tf_req = str(req.get("tf","any")).lower()
    side = str(req.get("side","any")).lower()
    for c in cards or []:
        patt = str(c.get("pattern","")).lower()
        prob = float(c.get("prob", 0.0))
        tf   = str(c.get("tf","")).lower()
        if name != "any" and patt != name:
            continue
        if tf_req != "any" and tf != tf_req:
            continue
        if prob < min_prob:
            continue
        if side == "bull" and patt in BEARISH_KEYS:
            continue
        if side == "bear" and patt in BULLISH_KEYS:
            continue
        return True
    return False

# =========================
# ----- Data loaders ------
# =========================
def _resample_1d(df_raw: pd.DataFrame) -> pd.DataFrame:
    # Expect columns: open, high, low, close, volume
    return pd.DataFrame({
        "open":   df_raw["open"].resample("1D").first(),
        "high":   df_raw["high"].resample("1D").max(),
        "low":    df_raw["low"].resample("1D").min(),
        "close":  df_raw["close"].resample("1D").last(),
        "volume": df_raw["volume"].resample("1D").sum(),
    }).dropna()

def _ccxt_ohlcv(symbol_pair="BTC/USDT", exchange_id="binance", timeframe="1d", since_days=540) -> pd.DataFrame:
    if ccxt is None:
        raise RuntimeError("ccxt not available")
    ex = getattr(ccxt, exchange_id)()
    since = int((_now_utc()-timedelta(days=since_days)).timestamp()*1000)
    out=[]
    while True:
        batch = ex.fetch_ohlcv(symbol_pair, timeframe=timeframe, since=since, limit=1000)
        if not batch: break
        out += batch
        since = batch[-1][0] + 1
        if len(batch) < 1000: break
        time.sleep(ex.rateLimit/1000.0)
    df = pd.DataFrame(out, columns=["t","open","high","low","close","volume"]).set_index("t")
    df.index = pd.to_datetime(df.index, unit="ms", utc=True)
    return _resample_1d(df)

def _cg_market_chart_range(symbol: str, vs="usd", days=540) -> pd.DataFrame:
    cid = COINGECKO_IDS.get(symbol)
    if cid is None:
        raise RuntimeError(f"CoinGecko id not known for {symbol}")
    end = int(time.time()); start = end - days*24*3600
    url = f"https://api.coingecko.com/api/v3/coins/{cid}/market_chart/range"
    r = requests.get(url, params={"vs_currency":vs,"from":start,"to":end}, timeout=30)
    r.raise_for_status()
    j = r.json()
    dp = pd.DataFrame(j["prices"], columns=["t","price"]).set_index("t")
    dv = pd.DataFrame(j["total_volumes"], columns=["t","volume"]).set_index("t")
    df = pd.DataFrame({
        "open": dp["price"],  # fallback approximation: no OHLC, we mirror price
        "high": dp["price"],
        "low":  dp["price"],
        "close":dp["price"],
        "volume": dv["volume"]
    })
    df.index = pd.to_datetime(df.index, unit="ms", utc=True)
    return _resample_1d(df)

def _load_ohlcv(symbol: str, days: int, exchange_id: str) -> pd.DataFrame:
    try:
        return _ccxt_ohlcv(f"{symbol}/USDT", exchange_id, "1d", since_days=days)
    except Exception:
        return _cg_market_chart_range(symbol, "usd", days)

_sid = SentimentIntensityAnalyzer()

def _fetch_cryptopanic_headlines(auth_token: str, page_size=100) -> pd.DataFrame:
    url = "https://cryptopanic.com/api/v1/posts/"
    r = requests.get(url, params={
        "auth_token": auth_token,
        "kind": "news",
        "filter": "rising|hot|bullish|bearish",
        "public": "true"
    }, timeout=20)
    r.raise_for_status()
    items = r.json().get("results", [])
    rows=[]
    for it in items:
        ts = pd.to_datetime(it["published_at"], utc=True)
        title = it.get("title","")
        assets = [t.get("code","").upper() for t in it.get("currencies", []) if t.get("code")]
        rows.append({"time": ts, "title": title, "assets": assets})
    return pd.DataFrame(rows)

def _sentiment_series_by_asset(headlines: pd.DataFrame) -> Dict[str,pd.Series]:
    if headlines.empty: return {}
    rows=[]
    for _,r in headlines.iterrows():
        s = _sid.polarity_scores(r["title"])["compound"]
        for a in (r["assets"] or []):
            rows.append({"time": r["time"], "asset": a, "score": float(s)})
    sdf = pd.DataFrame(rows)
    if sdf.empty: return {}
    sdf = sdf.set_index("time").groupby("asset")["score"].rolling("6H").mean().reset_index()
    out={}
    for a,g in sdf.groupby("asset"):
        out[a] = g.set_index("time")["score"].clip(-1,1)
    return out

# =========================
# ---- Gate tokenization ---
# =========================
_GATE_SMA_VOL = re.compile(r"SMA\((\d+),\s*VOLUME\)", re.I)
_GATE_SMA = re.compile(r"SMA\((\d+)\)", re.I)
_GATE_EMA = re.compile(r"EMA\((\d+)\)", re.I)

_GATE_ATR = re.compile(r"ATR\((\d+)\)", re.I)
_GATE_ADX = re.compile(r"ADX\((\d+)\)", re.I)
_GATE_DI_PLUS = re.compile(r"(?:DI\+|DI_PLUS)\((\d+)\)", re.I)
_GATE_DI_MINUS = re.compile(r"(?:DI\-|DI_MINUS)\((\d+)\)", re.I)

_GATE_DONCH_HI = re.compile(r"DONCHIAN_(?:HI|HIGH)\((\d+)\)", re.I)
_GATE_DONCH_LO = re.compile(r"DONCHIAN_(?:LO|LOW)\((\d+)\)", re.I)

_GATE_BB_UP = re.compile(r"BB_UP\((\d+)\s*,\s*([0-9]*\.?[0-9]+)\)", re.I)
_GATE_BB_MID = re.compile(r"BB_MID\((\d+)\)", re.I)
_GATE_BB_DN = re.compile(r"BB_DN\((\d+)\s*,\s*([0-9]*\.?[0-9]+)\)", re.I)
_GATE_BB_BW = re.compile(r"BB_BW_PCT\((\d+)\s*,\s*([0-9]*\.?[0-9]+)\)", re.I)

_GATE_KC_UP = re.compile(r"KC_UP\((\d+)\s*,\s*([0-9]*\.?[0-9]+)\)", re.I)
_GATE_KC_MID = re.compile(r"KC_MID\((\d+)\)", re.I)
_GATE_KC_DN = re.compile(r"KC_DN\((\d+)\s*,\s*([0-9]*\.?[0-9]+)\)", re.I)

_GATE_MACD_LINE = re.compile(r"MACD_LINE\((\d+)\s*,\s*(\d+)\)", re.I)
_GATE_MACD_SIGNAL = re.compile(r"MACD_SIGNAL\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)\)", re.I)
_GATE_MACD_HIST = re.compile(r"MACD_HIST\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)\)", re.I)

_GATE_STOCH_RSI_K = re.compile(r"STOCH_RSI_K\((\d+)\)", re.I)
_GATE_STOCH_RSI_D = re.compile(r"STOCH_RSI_D\((\d+)\)", re.I)

# pseudo boolean derived
_GATE_ADX_RISING = re.compile(r"ADX_RISING\((\d+)\)", re.I)

# vwap/obv/mfi/cmf (no params default; allow VWAP(n))
_GATE_VWAP_N = re.compile(r"VWAP\((\d+)\)", re.I)

def _replace_gate_tokens(E: str) -> str:
    # map words GOOD/BAD
    E = E.replace("GOOD", str(GOOD_THRESH)).replace("BAD", str(BAD_THRESH)).upper().strip()
    # basic
    E = _GATE_SMA_VOL.sub(lambda m: f"VOL_SMA_{m.group(1)}", E)
    E = _GATE_SMA.sub(lambda m: f"SMA_{m.group(1)}", E)
    E = _GATE_EMA.sub(lambda m: f"EMA_{m.group(1)}", E)
    E = E.replace("RSI(14)", "RSI_14").replace("RET_60D","RET_60D")
    # volatility/strength
    E = _GATE_ATR.sub(lambda m: f"ATR_{m.group(1)}", E)
    E = _GATE_ADX.sub(lambda m: f"ADX_{m.group(1)}", E)
    E = _GATE_DI_PLUS.sub(lambda m: f"DI_PLUS_{m.group(1)}", E)
    E = _GATE_DI_MINUS.sub(lambda m: f"DI_MINUS_{m.group(1)}", E)
    # donchian
    E = _GATE_DONCH_HI.sub(lambda m: f"DONCHIAN_HI_{m.group(1)}", E)
    E = _GATE_DONCH_LO.sub(lambda m: f"DONCHIAN_LO_{m.group(1)}", E)
    # bollinger
    E = _GATE_BB_UP.sub(lambda m: f"BB_UP_{m.group(1)}_{m.group(2)}", E)
    E = _GATE_BB_MID.sub(lambda m: f"BB_MID_{m.group(1)}", E)
    E = _GATE_BB_DN.sub(lambda m: f"BB_DN_{m.group(1)}_{m.group(2)}", E)
    E = _GATE_BB_BW.sub(lambda m: f"BB_BW_PCT_{m.group(1)}_{m.group(2)}", E)
    # keltner
    E = _GATE_KC_UP.sub(lambda m: f"KC_UP_{m.group(1)}_{m.group(2)}", E)
    E = _GATE_KC_MID.sub(lambda m: f"KC_MID_{m.group(1)}", E)
    E = _GATE_KC_DN.sub(lambda m: f"KC_DN_{m.group(1)}_{m.group(2)}", E)
    # macd
    E = _GATE_MACD_LINE.sub(lambda m: f"MACD_LINE_{m.group(1)}_{m.group(2)}", E)
    E = _GATE_MACD_SIGNAL.sub(lambda m: f"MACD_SIGNAL_{m.group(1)}_{m.group(2)}_{m.group(3)}", E)
    E = _GATE_MACD_HIST.sub(lambda m: f"MACD_HIST_{m.group(1)}_{m.group(2)}_{m.group(3)}", E)
    # stoch rsi
    E = _GATE_STOCH_RSI_K.sub(lambda m: f"STOCH_RSI_K_{m.group(1)}", E)
    E = _GATE_STOCH_RSI_D.sub(lambda m: f"STOCH_RSI_D_{m.group(1)}", E)
    # boolean derived
    E = _GATE_ADX_RISING.sub(lambda m: f"ADX_RISING_{m.group(1)}", E)
    # vwap
    E = _GATE_VWAP_N.sub(lambda m: f"VWAP_{m.group(1)}", E)
    # bare tokens allowed too: VWAP, OBV, MFI_14, CMF_20, etc. (handled in series getter)
    return E

def _evaluate_gate(expr: str, df: pd.DataFrame, sent: Optional[pd.Series]) -> pd.Series:
    """
    Supported tokens include:
      CLOSE, OPEN, HIGH, LOW, VOLUME
      SMA(n), EMA(n), RSI(14), RET_60D, SMA(n,VOLUME)
      ATR(n), ADX(n), DI+(n), DI-(n)
      DONCHIAN_HI(n), DONCHIAN_LO(n)
      BB_UP(n,k), BB_MID(n), BB_DN(n,k), BB_BW_PCT(n,k)
      KC_UP(n,m), KC_MID(n), KC_DN(n,m)
      MACD_LINE(fast,slow), MACD_SIGNAL(fast,slow,signal), MACD_HIST(fast,slow,signal)
      STOCH_RSI_K(n), STOCH_RSI_D(n)
      VWAP, VWAP(n), OBV, MFI(n), CMF(n)
      SENTIMENT
      ADX_RISING(n)  # boolean -> 1/0
      numbers, k*COL
    """
    E = _replace_gate_tokens(expr)
    m = re.match(r"(.+?)\s*(>=|<=|>|<|==)\s*(.+)", E)
    if not m:
        raise ValueError(f"Bad gate: {expr}")
    lhs, op, rhs = m.groups()

    def _col(tok: str) -> str:
        return {
            "CLOSE":"close","OPEN":"open","HIGH":"high","LOW":"low","VOLUME":"volume"
        }.get(tok, tok)

    def _series_of(term: str) -> pd.Series:
        term = term.strip()
        if term == "SENTIMENT":
            if sent is None:
                return pd.Series(index=df.index, data=0.0)
            return sent.reindex(df.index).ffill().fillna(0.0)
        # scalar * column?
        mm = re.match(r"([0-9]*\.?[0-9]+)\s*\*\s*([A-Z0-9_\.]+)", term)
        if mm:
            k = float(mm.group(1)); c = _col(mm.group(2))
            base = df[c] if c in df.columns else pd.Series(index=df.index, data=np.nan)
            return k * base
        # direct column
        if term in df.columns:
            return df[term]
        # scalar
        try:
            val = float(term)
            return pd.Series(index=df.index, data=val)
        except:
            # unknown token -> try mapped column name
            c = _col(term)
            if c in df.columns:
                return df[c]
            # if still not found, return NaNs (gate will evaluate to False)
            return pd.Series(index=df.index, data=np.nan)

    L = _series_of(lhs); R = _series_of(rhs)
    if   op == ">":  return (L >  R).fillna(False)
    elif op == "<":  return (L <  R).fillna(False)
    elif op == ">=": return (L >= R).fillna(False)
    elif op == "<=": return (L <= R).fillna(False)
    elif op == "==": return (L == R).fillna(False)
    else: raise ValueError("op")

def _evaluate_gate_weighted(expr: str, df: pd.DataFrame, sent: Optional[pd.Series]) -> float:
    """
    Evaluate gate expression and return a continuous score from 0.0 to 1.0
    instead of binary pass/fail. Provides smooth transitions around thresholds.
    """
    E = _replace_gate_tokens(expr)
    m = re.match(r"(.+?)\s*(>=|<=|>|<|==)\s*(.+)", E)
    if not m:
        raise ValueError(f"Bad gate: {expr}")
    lhs, op, rhs = m.groups()

    def _col(tok: str) -> str:
        return {
            "CLOSE":"close","OPEN":"open","HIGH":"high","LOW":"low","VOLUME":"volume"
        }.get(tok, tok)

    def _value_of(term: str) -> float:
        term = term.strip()
        if term == "SENTIMENT":
            if sent is None:
                return 0.0
            latest_sent = sent.reindex(df.index).ffill().fillna(0.0)
            return float(latest_sent.iloc[-1]) if len(latest_sent) > 0 else 0.0
        
        # scalar * column?
        mm = re.match(r"([0-9]*\.?[0-9]+)\s*\*\s*([A-Z0-9_\.]+)", term)
        if mm:
            k = float(mm.group(1)); c = _col(mm.group(2))
            base = df[c].iloc[-1] if c in df.columns else np.nan
            return k * base if pd.notna(base) else np.nan
        
        # direct column - get latest value
        if term in df.columns:
            return float(df[term].iloc[-1]) if len(df[term]) > 0 else np.nan
        
        # scalar
        try:
            return float(term)
        except:
            # unknown token -> try mapped column name
            c = _col(term)
            if c in df.columns:
                return float(df[c].iloc[-1]) if len(df[c]) > 0 else np.nan
            return np.nan

    L = _value_of(lhs)
    R = _value_of(rhs)
    
    if pd.isna(L) or pd.isna(R):
        return 0.0  # Missing data = fail
    
    # Convert comparison to 0-1 score with smooth transitions
    if op == ">":
        ratio = L / R if R != 0 else (1.0 if L > 0 else 0.0)
        # Smooth transition: full score at 105%+, zero at 95%-, linear between
        if ratio >= 1.05:
            return 1.0
        elif ratio >= 0.95:
            return (ratio - 0.95) / 0.10  # 0 to 1 over 10% range
        else:
            return 0.0
            
    elif op == ">=":
        ratio = L / R if R != 0 else (1.0 if L >= 0 else 0.0)
        # Smooth transition: full score at 100%+, zero at 80%-, linear between  
        if ratio >= 1.0:
            return 1.0
        elif ratio >= 0.8:
            return (ratio - 0.8) / 0.2  # 0 to 1 over 20% range
        else:
            return 0.0
            
    elif op == "<":
        ratio = L / R if R != 0 else (0.0 if L < 0 else 1.0)
        # Inverted: full score when well below, zero when above
        if ratio <= 0.95:
            return 1.0
        elif ratio <= 1.05:
            return (1.05 - ratio) / 0.10
        else:
            return 0.0
            
    elif op == "<=":
        ratio = L / R if R != 0 else (1.0 if L <= 0 else 0.0)
        # Inverted: full score when at/below, zero when well above
        if ratio <= 1.0:
            return 1.0
        elif ratio <= 1.2:
            return (1.2 - ratio) / 0.2
        else:
            return 0.0
            
    elif op == "==":
        # Equality with tolerance
        diff = abs(L - R) / (abs(R) + 1e-12)
        if diff <= 0.02:  # Within 2%
            return 1.0
        elif diff <= 0.1:  # Within 10%
            return (0.1 - diff) / 0.08
        else:
            return 0.0
    
    return 0.0

# =========================
# --- Feature building ----
# =========================
def _derive_features(ohlcv: Dict[str,pd.DataFrame], feats: List[str]) -> Dict[str,pd.DataFrame]:
    out={}
    # parse param-bearing names quickly
    def _last_float(s): 
        try: return float(s.split("_")[-1])
        except: return None

    for a,df in ohlcv.items():
        x = df.copy()
        close, high, low, vol = x["close"], x["high"], x["low"], x["volume"]

        # 1) First pass: collect parameter sets so we don't recompute same window many times
        sma_ns = sorted({int(f.split("_")[1]) for f in feats if f.startswith("SMA_")})
        ema_ns = sorted({int(f.split("_")[1]) for f in feats if f.startswith("EMA_")})
        vol_sma_ns = sorted({int(f.split("_")[2]) for f in feats if f.startswith("VOL_SMA_")})
        atr_ns = sorted({int(f.split("_")[1]) for f in feats if f.startswith("ATR_")})
        adx_ns = sorted({int(f.split("_")[1]) for f in feats if f.startswith("ADX_") and not f.startswith("ADX_RISING_")} | 
                        {int(f.split("_")[2]) for f in feats if f.startswith("DI_PLUS_")} |
                        {int(f.split("_")[2]) for f in feats if f.startswith("DI_MINUS_")} |
                        {int(f.split("_")[2]) for f in feats if f.startswith("ADX_RISING_")})
        don_ns_hi = sorted({int(f.split("_")[2]) for f in feats if f.startswith("DONCHIAN_HI_")})
        don_ns_lo = sorted({int(f.split("_")[2]) for f in feats if f.startswith("DONCHIAN_LO_")})
        bb_params = {(int(f.split("_")[2]), float(_last_float(f))) for f in feats if f.startswith("BB_UP_") or f.startswith("BB_DN_")} | \
                    {(int(f.split("_")[3]), float(_last_float(f))) for f in feats if f.startswith("BB_BW_PCT_")}
        kc_params = {(int(f.split("_")[2]), float(_last_float(f))) for f in feats if f.startswith("KC_UP_") or f.startswith("KC_DN_")}
        kc_mids  = {int(f.split("_")[2]) for f in feats if f.startswith("KC_MID_")}
        macd_params = {(int(f.split("_")[2]), int(f.split("_")[3]), int(_last_float(f))) for f in feats if f.startswith("MACD_SIGNAL_") or f.startswith("MACD_HIST_")}
        macd_lines  = {(int(f.split("_")[3]), int(_last_float(f))) for f in feats if f.startswith("MACD_LINE_")}
        stoch_rsi_ns_k = {int(f.split("_")[3]) for f in feats if f.startswith("STOCH_RSI_K_")}
        stoch_rsi_ns_d = {int(f.split("_")[3]) for f in feats if f.startswith("STOCH_RSI_D_")}
        vwap_ns = {int(f.split("_")[1]) for f in feats if f.startswith("VWAP_") and f != "VWAP"}
        # 2) Core helpers
        for n in sma_ns: x[f"SMA_{n}"] = _sma(close, n)
        for n in ema_ns: x[f"EMA_{n}"] = _ema(close, n)
        for n in vol_sma_ns: x[f"VOL_SMA_{n}"] = _vol_sma(vol, n)
        if "RSI_14" in feats: x["RSI_14"] = _rsi(close, 14)
        if "RET_60D" in feats: x["RET_60D"] = _ret_nd(close, 60)

        for n in atr_ns: x[f"ATR_{n}"] = _atr(high, low, close, n)

        # ADX/DI卤/ADX_RISING
        adx_cache: Dict[int, Tuple[pd.Series,pd.Series,pd.Series]] = {}
        for n in adx_ns:
            adx, dpl, dmn = _adx_di(high, low, close, n)
            adx_cache[n] = (adx, dpl, dmn)
            x[f"ADX_{n}"] = adx
            x[f"DI_PLUS_{n}"]  = dpl
            x[f"DI_MINUS_{n}"] = dmn
            if f"ADX_RISING_{n}" in feats:
                xr = (adx > adx.shift(1)).astype(float)
                x[f"ADX_RISING_{n}"] = xr

        # Donchian
        for n in don_ns_hi: x[f"DONCHIAN_HI_{n}"] = _donchian_hi(high, n)
        for n in don_ns_lo: x[f"DONCHIAN_LO_{n}"] = _donchian_lo(low, n)

        # Bollinger / BW%
        for (n,k) in bb_params:
            basis, up, dn, bw_pct = _bb(close, n, k)
            if f"BB_MID_{n}" in feats: x[f"BB_MID_{n}"] = basis
            if f"BB_UP_{n}_{k}" in feats: x[f"BB_UP_{n}_{k}"] = up
            if f"BB_DN_{n}_{k}" in feats: x[f"BB_DN_{n}_{k}"] = dn
            if f"BB_BW_PCT_{n}_{k}" in feats: x[f"BB_BW_PCT_{n}_{k}"] = bw_pct

        # Keltner
        for (n,m) in kc_params:
            kc_mid, kc_up, kc_dn = _kc(close, high, low, n, m)
            if f"KC_MID_{n}" in feats: x[f"KC_MID_{n}"] = kc_mid
            if f"KC_UP_{n}_{m}" in feats: x[f"KC_UP_{n}_{m}"] = kc_up
            if f"KC_DN_{n}_{m}" in feats: x[f"KC_DN_{n}_{m}"] = kc_dn
        for n in kc_mids:
            if f"KC_MID_{n}" not in x.columns:
                kc_mid, _, _ = _kc(close, high, low, n, 1.5)
                x[f"KC_MID_{n}"] = kc_mid

        # MACD
        for (f,s) in macd_lines:
            macd_line, _, _ = _macd(close, f, s, 9)
            x[f"MACD_LINE_{f}_{s}"] = macd_line
        for (f,s,sg) in macd_params:
            ml, sl, hist = _macd(close, f, s, sg)
            if f"MACD_SIGNAL_{f}_{s}_{sg}" in feats: x[f"MACD_SIGNAL_{f}_{s}_{sg}"] = sl
            if f"MACD_HIST_{f}_{s}_{sg}" in feats:   x[f"MACD_HIST_{f}_{s}_{sg}"]   = hist

        # VWAP/OBV/MFI/CMF
        if "VWAP" in feats: x["VWAP"] = _vwap_daily_anchored(close, vol)
        for n in vwap_ns: x[f"VWAP_{n}"] = _vwap_rolling(close, vol, n)
        if "OBV" in feats: x["OBV"] = _obv(close, vol)

        # infer common window for MFI/CMF if requested
        mfi_ns = {int(f.split("_")[1]) for f in feats if f.startswith("MFI_")}
        for n in mfi_ns: x[f"MFI_{n}"] = _mfi(high, low, close, vol, n)
        cmf_ns = {int(f.split("_")[1]) for f in feats if f.startswith("CMF_")}
        for n in cmf_ns: x[f"CMF_{n}"] = _cmf(high, low, close, vol, n)

        # Stoch RSI
        for n in stoch_rsi_ns_k:
            k_line, _ = _stoch_rsi(close, rsi_len=14, stoch_len=n, k=3, d=3)
            x[f"STOCH_RSI_K_{n}"] = k_line
        for n in stoch_rsi_ns_d:
            k_line, d_line = _stoch_rsi(close, rsi_len=14, stoch_len=n, k=3, d=3)
            x[f"STOCH_RSI_D_{n}"] = d_line

        out[a]=x
    return out

def _features_from_gates(plan: Dict) -> List[str]:
    feats=set()
    gates = (plan.get("gates", {}) or {})
    exprs = (gates.get("all_of") or []) + (gates.get("any_of") or [])
    for g in exprs:
        e = str(g.get("expr","")).upper()

        for n in _GATE_SMA.findall(e): feats.add(f"SMA_{n}")
        for n in _GATE_EMA.findall(e): feats.add(f"EMA_{n}")
        for n in _GATE_SMA_VOL.findall(e): feats.add(f"VOL_SMA_{n}")

        if "RSI(14)" in e: feats.add("RSI_14")
        if "RET_60D" in e: feats.add("RET_60D")
        if "SENTIMENT" in e: feats.add("SENTIMENT")

        # ATR/ADX/DI
        for n in _GATE_ATR.findall(e): feats.add(f"ATR_{n}")
        for n in _GATE_ADX.findall(e): feats.add(f"ADX_{n}")
        for n in _GATE_DI_PLUS.findall(e): feats.add(f"DI_PLUS_{n}")
        for n in _GATE_DI_MINUS.findall(e): feats.add(f"DI_MINUS_{n}")
        for n in _GATE_ADX_RISING.findall(e): feats.add(f"ADX_RISING_{n}")

        # Donchian
        for n in _GATE_DONCH_HI.findall(e): feats.add(f"DONCHIAN_HI_{n}")
        for n in _GATE_DONCH_LO.findall(e): feats.add(f"DONCHIAN_LO_{n}")

        # BB/KC
        for n,k in _GATE_BB_UP.findall(e): feats |= {f"BB_UP_{n}_{k}", f"BB_MID_{n}"}
        for n,k in _GATE_BB_DN.findall(e): feats |= {f"BB_DN_{n}_{k}", f"BB_MID_{n}"}
        for n,k in _GATE_BB_BW.findall(e): feats |= {f"BB_BW_PCT_{n}_{k}", f"BB_MID_{n}"}
        for n,k in _GATE_KC_UP.findall(e): feats |= {f"KC_UP_{n}_{k}", f"KC_MID_{n}"}
        for n,k in _GATE_KC_DN.findall(e): feats |= {f"KC_DN_{n}_{k}", f"KC_MID_{n}"}
        for n in _GATE_KC_MID.findall(e): feats.add(f"KC_MID_{n}")

        # MACD
        for f,s in _GATE_MACD_LINE.findall(e): feats.add(f"MACD_LINE_{f}_{s}")
        for f,s,sg in _GATE_MACD_SIGNAL.findall(e): feats.add(f"MACD_SIGNAL_{f}_{s}_{sg}")
        for f,s,sg in _GATE_MACD_HIST.findall(e): feats.add(f"MACD_HIST_{f}_{s}_{sg}")

        # STOCH RSI
        for n in _GATE_STOCH_RSI_K.findall(e): feats.add(f"STOCH_RSI_K_{n}")
        for n in _GATE_STOCH_RSI_D.findall(e): feats.add(f"STOCH_RSI_D_{n}")

        # VWAP/OBV/MFI/CMF (free-text)
        if "VWAP(" in e:  # rolling
            for n in _GATE_VWAP_N.findall(e): feats.add(f"VWAP_{n}")
        if "VWAP" in e: feats.add("VWAP")
        if "OBV" in e: feats.add("OBV")
        # free-text like MFI(14) / CMF(20)
        mfi = re.findall(r"MFI\((\d+)\)", e)
        for n in mfi: feats.add(f"MFI_{n}")
        cmf = re.findall(r"CMF\((\d+)\)", e)
        for n in cmf: feats.add(f"CMF_{n}")

    # Include features required by hard rules (custom_rules) as well
    for hr in (plan.get("hard_rules") or []):
        e = str(hr.get("expr","")).upper()
        for n in _GATE_SMA.findall(e): feats.add(f"SMA_{n}")
        for n in _GATE_EMA.findall(e): feats.add(f"EMA_{n}")
        for n in _GATE_SMA_VOL.findall(e): feats.add(f"VOL_SMA_{n}")
        if "RSI(14)" in e: feats.add("RSI_14")
        if "RET_60D" in e: feats.add("RET_60D")
        if "SENTIMENT" in e: feats.add("SENTIMENT")
        for n in _GATE_ATR.findall(e): feats.add(f"ATR_{n}")
        for n in _GATE_ADX.findall(e): feats.add(f"ADX_{n}")
        for n in _GATE_DI_PLUS.findall(e): feats.add(f"DI_PLUS_{n}")
        for n in _GATE_DI_MINUS.findall(e): feats.add(f"DI_MINUS_{n}")
        for n in _GATE_ADX_RISING.findall(e): feats.add(f"ADX_RISING_{n}")
        for n in _GATE_DONCH_HI.findall(e): feats.add(f"DONCHIAN_HI_{n}")
        for n in _GATE_DONCH_LO.findall(e): feats.add(f"DONCHIAN_LO_{n}")
        for n,k in _GATE_BB_UP.findall(e): feats |= {f"BB_UP_{n}_{k}", f"BB_MID_{n}"}
        for n,k in _GATE_BB_DN.findall(e): feats |= {f"BB_DN_{n}_{k}", f"BB_MID_{n}"}
        for n,k in _GATE_BB_BW.findall(e): feats |= {f"BB_BW_PCT_{n}_{k}", f"BB_MID_{n}"}
        for n,k in _GATE_KC_UP.findall(e): feats |= {f"KC_UP_{n}_{k}", f"KC_MID_{n}"}
        for n,k in _GATE_KC_DN.findall(e): feats |= {f"KC_DN_{n}_{k}", f"KC_MID_{n}"}
        for n in _GATE_KC_MID.findall(e): feats.add(f"KC_MID_{n}")
        for f,s in _GATE_MACD_LINE.findall(e): feats.add(f"MACD_LINE_{f}_{s}")
        for f,s,sg in _GATE_MACD_SIGNAL.findall(e): feats.add(f"MACD_SIGNAL_{f}_{s}_{sg}")
        for f,s,sg in _GATE_MACD_HIST.findall(e): feats.add(f"MACD_HIST_{f}_{s}_{sg}")
        for n in _GATE_STOCH_RSI_K.findall(e): feats.add(f"STOCH_RSI_K_{n}")
        for n in _GATE_STOCH_RSI_D.findall(e): feats.add(f"STOCH_RSI_D_{n}")
        if "VWAP(" in e:
            for n in _GATE_VWAP_N.findall(e): feats.add(f"VWAP_{n}")
        if "VWAP" in e: feats.add("VWAP")
        if "OBV" in e: feats.add("OBV")
        mfi = re.findall(r"MFI\((\d+)\)", e)
        for n in mfi: feats.add(f"MFI_{n}")
        cmf = re.findall(r"CMF\((\d+)\)", e)
        for n in cmf: feats.add(f"CMF_{n}")

    # ensure composite helpers
    feats |= {"SMA_30","VOL_SMA_30","RET_60D","RSI_14"}
    return sorted(list(feats))

def _lookback_days_from_feats(feats: List[str]) -> int:
    wins=[]
    for f in feats:
        if f.startswith("SMA_") or f.startswith("EMA_"): wins.append(int(f.split("_")[1]))
        if f.startswith("VOL_SMA_"): wins.append(int(f.split("_")[2]))
        if f.startswith("ATR_"): wins.append(int(f.split("_")[1]))
        if f.startswith("ADX_") and not f.startswith("ADX_RISING_"): wins.append(int(f.split("_")[1]))
        if f.startswith("DI_PLUS_") or f.startswith("DI_MINUS_") or f.startswith("ADX_RISING_"): wins.append(int(f.split("_")[-1]))
        if f.startswith("DONCHIAN_"): wins.append(int(f.split("_")[-1]))
        if f.startswith("BB_"): 
            try: wins.append(int(f.split("_")[2]))
            except: pass
        if f.startswith("KC_"):
            try: wins.append(int(f.split("_")[2]))
            except: pass
        if f.startswith("MFI_") or f.startswith("CMF_"): wins.append(int(f.split("_")[1]))
        if f=="RET_60D": wins.append(60)
        if f=="RSI_14": wins.append(14)
    need = max(wins or [60])
    return int(min(MAX_LOOKBACK_D, max(90, math.ceil(need*1.2))))

# =========================
# ---- Combine / Score ----
# =========================
def _combine_gates(plan: Dict,
                   feats: Dict[str,pd.DataFrame],
                   sent_by_asset: Dict[str,pd.Series],
                   pattern_cards_by_asset: Optional[Dict[str, List[Dict]]] = None) -> Dict[str,pd.Series]:
    gates = (plan.get("gates",{}) or {})
    all_of = gates.get("all_of") or []
    any_of = gates.get("any_of") or []
    patt_reqs = gates.get("patterns") or []  # list of dicts

    elig={}
    for a,df in feats.items():
        s = pd.Series(True, index=df.index)
        for g in all_of:
            s &= _evaluate_gate(g["expr"], df, sent_by_asset.get(a))
        if any_of:
            s_any = pd.Series(False, index=df.index)
            for g in any_of:
                s_any |= _evaluate_gate(g["expr"], df, sent_by_asset.get(a))
            s &= s_any
        if patt_reqs:
            cards = (pattern_cards_by_asset or {}).get(a, [])
            ok = all(_passes_pattern_gate(cards, req) for req in patt_reqs)
            if not ok:
                s[:] = False
        elig[a]=s.fillna(False)
    return elig

def _combine_gates_weighted(plan: Dict,
                           feats: Dict[str,pd.DataFrame],
                           sent_by_asset: Dict[str,pd.Series],
                           pattern_cards_by_asset: Optional[Dict[str, List[Dict]]] = None) -> Dict[str,float]:
    """
    Calculate weighted eligibility scores (0.0 to 1.0) instead of binary pass/fail.
    Uses gate weights from plan configuration.
    """
    gates = (plan.get("gates",{}) or {})
    all_of = gates.get("all_of") or []
    any_of = gates.get("any_of") or []
    patt_reqs = gates.get("patterns") or []
    
    # Default gate weights - can be overridden in plan (either top-level "gate_weights" or "eligibility.gate_weights")
    gate_weights = (plan.get("eligibility", {}).get("gate_weights")
                    or plan.get("gate_weights")
                    or {
                        "trend_gates": 0.4,      # Market structure
                        "momentum_gates": 0.3,   # Entry timing  
                        "volume_gates": 0.2,     # Confirmation
                        "sentiment_gates": 0.1   # Sentiment overlay
                    })
    
    # Classify gates by type based on expression content
    def _classify_gate(expr: str) -> str:
        expr_upper = expr.upper()
        if any(x in expr_upper for x in ["SMA", "EMA", "DONCHIAN", "BB_"]):
            return "trend_gates"
        elif any(x in expr_upper for x in ["RSI", "ADX", "RET_", "MACD"]):
            return "momentum_gates" 
        elif any(x in expr_upper for x in ["VOLUME", "VOL_", "OBV", "CMF", "MFI"]):
            return "volume_gates"
        elif "SENTIMENT" in expr_upper:
            return "sentiment_gates"
        else:
            return "momentum_gates"  # Default classification
    
    elig_scores = {}
    for a, df in feats.items():
        gate_scores = {"trend_gates": [], "momentum_gates": [], "volume_gates": [], "sentiment_gates": []}
        
        # Evaluate all_of gates with weighted scoring
        for g in all_of:
            expr = g["expr"]
            score = _evaluate_gate_weighted(expr, df, sent_by_asset.get(a))
            gate_type = _classify_gate(expr)
            gate_scores[gate_type].append(score)
        
        # Evaluate any_of gates (take max score within group)
        if any_of:
            any_scores = []
            for g in any_of:
                expr = g["expr"]
                score = _evaluate_gate_weighted(expr, df, sent_by_asset.get(a))
                any_scores.append(score)
            if any_scores:
                gate_scores["momentum_gates"].append(max(any_scores))
        
        # Pattern requirements (simplified to binary for now)
        if patt_reqs:
            cards = (pattern_cards_by_asset or {}).get(a, [])
            pattern_score = 1.0 if all(_passes_pattern_gate(cards, req) for req in patt_reqs) else 0.0
            gate_scores["trend_gates"].append(pattern_score)
        
        # Calculate weighted average of gate scores
        total_score = 0.0
        total_weight = 0.0
        
        for gate_type, scores in gate_scores.items():
            if scores:
                avg_score = sum(scores) / len(scores)
                weight = float(gate_weights.get(gate_type, 0.0))
                total_score += weight * avg_score
                total_weight += weight
        
        # Normalize if we have any gates
        final_score = total_score / total_weight if total_weight > 0 else 1.0
        elig_scores[a] = max(0.0, min(1.0, final_score))
    
    return elig_scores

def _composite_scores(plan: Dict,
                      feats: Dict[str,pd.DataFrame],
                      sent_by_asset: Dict[str,pd.Series],
                      pattern_cards_by_asset: Optional[Dict[str,List[Dict]]] = None) -> Dict[str,pd.Series]:
    coef = _safe_coeffs(plan)  # may include "pattern"
    out={}
    for a,df in feats.items():
        trend = (df["close"]/df.get("SMA_30", df["close"]) - 1.0).clip(lower=-1, upper=+10).fillna(0.0)
        mom   = df.get("RET_60D", pd.Series(0.0, index=df.index)).clip(lower=-1, upper=+10).fillna(0.0)
        volx  = (df["volume"]/df.get("VOL_SMA_30", df["volume"]) - 1.0).clip(lower=-1, upper=+10).fillna(0.0)
        sent  = sent_by_asset.get(a)
        if sent is None:
            sent = pd.Series(0.0, index=df.index)
        else:
            sent = sent.reindex(df.index).ffill().fillna(0.0).clip(-1,1)

        base = (coef.get("trend",0)*trend.clip(lower=0)
              + coef.get("mom",0)*mom.clip(lower=0)
              + coef.get("vol",0)*volx.clip(lower=0)
              + coef.get("sent",0)*sent.clip(lower=0))

        patt_c = 0.0
        if pattern_cards_by_asset is not None:
            patt_c = _pattern_score_from_cards(pattern_cards_by_asset.get(a, []))
        patt_series = pd.Series(patt_c, index=df.index, dtype=float)

        out[a] = (base + coef.get("pattern",0)*patt_series).astype(float)
    return out

def _latest_common_index(ohlcv: Dict[str,pd.DataFrame]) -> pd.Timestamp:
    last = [df.index.max() for df in ohlcv.values() if len(df)]
    return min(last) if last else pd.NaT

def plan_trades(current_w: Dict[str,float],
                target_w: Dict[str,float],
                port_value_usd: float,
                band_pp: float = 5.0,
                turnover_max: float = 0.15,
                order_chunk_usd: float = 2000.0,
                slippage_bps: int = 80) -> Dict:
    to_dollars, turnover = {}, 0.0
    for a,tw in target_w.items():
        cw = current_w.get(a, 0.0)
        diff = tw - cw
        if abs(diff) > (band_pp/100.0):
            adj = diff*0.5
            usd = adj*port_value_usd
            to_dollars[a]=usd
            turnover += abs(usd)
    if turnover > (turnover_max*port_value_usd) and turnover > 0:
        scale = (turnover_max*port_value_usd)/turnover
        to_dollars = {a: v*scale for a,v in to_dollars.items()}
    orders=[]
    for a,usd in to_dollars.items():
        side = "BUY" if usd>0 else "SELL"
        remain = abs(usd)
        chunks=[]
        while remain > 0:
            c = min(order_chunk_usd, remain)
            chunks.append(c); remain -= c
        orders.append({"asset":a,"side":side,"usd":abs(usd),"chunks":chunks,"slippage_bps":slippage_bps})
    return {"orders": orders}

# =========================
# ---- Plan normalizer ----
# =========================
def _normalize_plan(raw: Dict) -> Tuple[Dict, List[str]]:
    """
    Accepts richer JSON (universe_list, custom_rules, gates.trend.ema_short/ema_long, adx_min,
    gates.range.bb_bw_pct_max, gates.breakout.{donchian_n,min_vol_mult,adx_rising}, weighting.mode,
    tilt_sentiment_pct, patterns, eligibility config, etc.) and returns an engine-compatible plan + warnings.
    """
    global GOOD_THRESH, BAD_THRESH
    warn=[]
    plan = dict(raw)  # shallow copy

    # universe aliases
    if "universe" not in plan and "universe_list" in plan:
        plan["universe"] = plan.get("universe_list") or []
    plan["universe"] = plan.get("universe") or ["BTC","ETH","SOL"]

    gates = plan.get("gates") or {}
    all_of: List[Dict] = []
    any_of: List[Dict] = []

    # ---------- HARD RULES (from custom_rules) ----------
    # Move custom_rules into plan["hard_rules"] as canonical expressions
    hard_rules: List[Dict] = []
    for r in plan.get("custom_rules") or []:
        rr = str(r).upper()
        # Normalize SMA/EMA on CLOSE to SMA(n)/EMA(n)
        rr = re.sub(r"SMA\(CLOSE\s*,\s*", "SMA(", rr)
        rr = re.sub(r"EMA\(CLOSE\s*,\s*", "EMA(", rr)
        rr = rr.replace("CLOSE", "CLOSE")
        hard_rules.append({"expr": rr})
    plan["hard_rules"] = hard_rules  # stored for later enforcement and feature building

    # ---------- SOFT GATES ----------
    # trend ema crossover
    trend = gates.get("trend") or {}
    es, el = trend.get("ema_short"), trend.get("ema_long")
    if es and el:
        all_of.append({"expr": f"EMA({int(es)}) > EMA({int(el)})"})
    # ADX mins/maxs (default period 14)
    if "adx_min" in (gates.get("trend") or {}):
        all_of.append({"expr": f"ADX(14) >= {float(gates['trend']['adx_min'])}"})
    if "adx_max" in (gates.get("range") or {}):
        all_of.append({"expr": f"ADX(14) <= {float(gates['range']['adx_max'])}"})

    # Range: bb bandwidth pct
    if "bb_bw_pct_max" in (gates.get("range") or {}):
        try:
            v = float(gates["range"]["bb_bw_pct_max"])
            all_of.append({"expr": f"BB_BW_PCT(20,2) <= {v}"})
        except Exception:
            warn.append("gates.range.bb_bw_pct_max invalid; expected a number")

    # Breakout: Donchian + volume multiple + ADX rising
    br = gates.get("breakout") or {}
    don_n = br.get("donchian_n")
    if don_n:
        all_of.append({"expr": f"CLOSE >= DONCHIAN_HI({int(don_n)})"})
    if "min_vol_mult" in br:
        try:
            v = float(br["min_vol_mult"])
            all_of.append({"expr": f"VOLUME >= {v} * SMA(30, VOLUME)"})
        except Exception:
            warn.append("gates.breakout.min_vol_mult invalid; expected a number")
    if br.get("adx_rising", False):
        all_of.append({"expr": "ADX_RISING(14) >= 1"})

    # Support: rsi_min ok; atr_mult ambiguous (stop sizing), warn only
    support = gates.get("support") or {}
    if "rsi_min" in support:
        all_of.append({"expr": f"RSI(14) >= {float(support['rsi_min'])}"})
    if "atr_mult" in support:
        warn.append("gates.support.atr_mult is not enforced as a gate (used typically for stops).")

    # sentiment thresholds from cfg
    sent_cfg = plan.get("sentiment_cfg") or {}
    good_thr = float(sent_cfg.get("good_threshold", GOOD_THRESH))
    bad_thr  = float(sent_cfg.get("bad_threshold", BAD_THRESH))
    # If gates.sentiment is numeric or word, treat as additional soft gate; if "AUTO" or absent, skip hard gate
    if isinstance(gates.get("sentiment", None), (int, float, str)):
        if isinstance(gates["sentiment"], (int,float)):
            all_of.append({"expr": f"SENTIMENT >= {float(gates['sentiment'])}"})
        elif isinstance(gates["sentiment"], str) and gates["sentiment"].strip().upper() not in ("AUTO",""):
            word = gates["sentiment"].strip().upper()
            thr = good_thr if word == "GOOD" else bad_thr if word == "BAD" else None
            if thr is not None:
                all_of.append({"expr": f"SENTIMENT >= {thr}"})

    # pattern gates passthrough (list of dicts)
    patt_reqs = gates.get("patterns") or []
    if patt_reqs and not isinstance(patt_reqs, list):
        warn.append("gates.patterns must be a list of requirements; ignoring invalid value.")
        patt_reqs = []
    plan["gates"] = {"all_of": all_of, "any_of": any_of, "patterns": patt_reqs}

    # risk & rebalance defaults
    plan.setdefault("rebalance", {})
    plan.setdefault("risk", {})
    plan["rebalance"].setdefault("band_pp", 5.0)
    plan["rebalance"].setdefault("turnover_max", 0.15)
    plan["rebalance"].setdefault("hard_cap", float(plan["risk"].get("hard_cap", 0.50)))
    plan["rebalance"]["hard_cap"] = float(plan["rebalance"]["hard_cap"])
    plan["risk"].setdefault("max_weight", 0.40)
    plan["risk"].setdefault("slippage_max_bps", 80)
    plan["risk"].setdefault("order_max_usd", float((plan.get("execution") or {}).get("chunk_usd", 2000.0)))
    plan["risk"].setdefault("cooldown_hours", 6)
    plan["risk"].setdefault("strict_caps", True)

    # weighting
    weighting = plan.setdefault("weighting", {})
    if "tilt_sentiment_pct" in weighting:
        try:
            weighting["tilt_sentiment_pct"] = float(weighting["tilt_sentiment_pct"])
        except Exception:
            weighting["tilt_sentiment_pct"] = 0.0
    coeffs = weighting.get("coeffs") or {}
    for old, new in (("momentum","mom"), ("volume","vol"), ("sentiment","sent")):
        if old in coeffs and new not in coeffs:
            coeffs[new] = coeffs.pop(old)
    weighting["coeffs"] = coeffs

    # eligibility config defaults (configurable)
    elig = plan.setdefault("eligibility", {})
    elig.setdefault("weighted", plan.get("use_weighted_eligibility", True))
    elig.setdefault("hard_from_custom_rules", True)  # treat custom_rules as hard requirement
    elig.setdefault("zero_if_hard_fail", True)       # zero-out if hard rules fail
    elig.setdefault("floor_if_hard_ok", 0.10)        # minimum multiplier if hard rules pass but soft gates weak
    # tier thresholds & multipliers (from high to low)
    elig.setdefault("tiers", [0.8, 0.6, 0.4, 0.2])
    elig.setdefault("tier_multipliers", [1.0, 0.8, 0.5, 0.2, 0.0])  # last is default if below lowest tier
    # whether in binary mode we soften non-hard gates (only require hard rules)
    elig.setdefault("soften_non_hard_gates_in_binary", True)

    # expose thresholds
    GOOD_THRESH = good_thr
    BAD_THRESH  = bad_thr

    return plan, warn

# ==========================================================
# =============== PUBLIC ENTRYPOINT (CALL THIS) ============
# ==========================================================
def compute_weights_now(
    plan: Dict,
    *,
    cp_key: Optional[str] = None,
    ohlcv: Optional[Dict[str,pd.DataFrame]] = None,
    sentiment: Optional[Dict[str,pd.Series]] = None,
    pattern_cards_by_asset: Optional[Dict[str, List[Dict]]] = None,
    exchange_id: str = "binance",
    lookback_override_days: Optional[int] = None,
    current_weights: Optional[Dict[str,float]] = None,
    portfolio_value_usd: Optional[float] = None
) -> Dict:
    """
    Returns a dict with fields:
      - as_of: ISO timestamp (UTC)
      - eligibility: {asset: bool} OR {asset: float} (weighted score)
      - scores: {asset: float}
      - target_weights: {asset: float}
      - explain: {asset: [bullets]}
      - trade_plan: {orders:[...]}  # only if current_weights & portfolio_value_usd provided
      - features_used: [str]
      - warnings: [str]
      - weighted_eligibility_scores (if weighted): {asset: float}

    Data loading:
      - If `ohlcv` / `sentiment` provided, they are used as-is.
      - Else: fetch OHLCV (ccxt primary 鈫?CoinGecko fallback) and CryptoPanic sentiment (if cp_key).
      - Pattern detection is external; pass `pattern_cards_by_asset`.
    """
    plan, warnings = _normalize_plan(plan)
    assets = plan.get("universe") or ["BTC","ETH","SOL"]

    feats_needed = _features_from_gates(plan)
    lookback_days = lookback_override_days or _lookback_days_from_feats(feats_needed)

    # Data
    used_cg_fallback = []
    stablecoins_skipped = []
    if ohlcv is None:
        ohlcv = {}
        for a in assets:
            # Skip price data loading for stablecoins (they're stable ~$1)
            if a.upper() in STABLECOINS:
                # Create dummy OHLCV data for stablecoins (all prices = 1.0)
                dates = pd.date_range(end=datetime.now(timezone.utc), periods=lookback_days, freq='D', tz='UTC')
                ohlcv[a] = pd.DataFrame({
                    'open': [1.0] * lookback_days,
                    'high': [1.0] * lookback_days,
                    'low': [1.0] * lookback_days,
                    'close': [1.0] * lookback_days,
                    'volume': [1000000.0] * lookback_days  # Dummy volume
                }, index=dates)
                stablecoins_skipped.append(a)
                continue
                
            try:
                ohlcv[a] = _load_ohlcv(a, lookback_days, exchange_id)
            except Exception:
                ohlcv[a] = _cg_market_chart_range(a, "usd", lookback_days)
                used_cg_fallback.append(a)

    if used_cg_fallback:
        warnings.append(f"Fallback to CoinGecko for {used_cg_fallback}; High/Low are approximated, ATR/Donchian/CMF/MFI may be degraded.")
    
    if stablecoins_skipped:
        warnings.append(f"Stablecoins {stablecoins_skipped} use dummy price data (stable at $1.00) - no price analysis performed.")

    if sentiment is None:
        if cp_key:
            heads = _fetch_cryptopanic_headlines(cp_key)
            sentiment = _sentiment_series_by_asset(heads)
        else:
            sentiment = {}

    # Derived features
    feat_tables = _derive_features(ohlcv, feats_needed)

    # Compute "as_of" = latest common bar across assets
    as_of = _latest_common_index(ohlcv)
    if pd.isna(as_of):
        raise RuntimeError("No overlapping OHLCV data across assets")

    # -----------------------------
    # Hard rules evaluation (custom_rules)
    # -----------------------------
    elig_cfg = plan.get("eligibility", {}) or {}
    hard_from_custom = bool(elig_cfg.get("hard_from_custom_rules", True))
    zero_if_hard_fail = bool(elig_cfg.get("zero_if_hard_fail", True))
    floor_if_hard_ok = float(elig_cfg.get("floor_if_hard_ok", 0.10))

    hard_ok = {a: True for a in assets}
    if hard_from_custom and plan.get("hard_rules"):
        for a, df in feat_tables.items():
            ok = True
            for hr in plan["hard_rules"]:
                try:
                    series = _evaluate_gate(hr["expr"], df, (sentiment or {}).get(a))
                    passed = bool(series.loc[:as_of].iloc[-1]) if len(series.loc[:as_of]) else False
                except Exception:
                    passed = False
                ok = ok and passed
            hard_ok[a] = ok

    # -----------------------------
    # Eligibility (weighted vs binary)
    # -----------------------------
    use_weighted_eligibility = bool(elig_cfg.get("weighted", plan.get("use_weighted_eligibility", True)))
    scores_all = _composite_scores(plan, feat_tables, sentiment, pattern_cards_by_asset)

    # Prepare multipliers config (for weighted mode)
    tier_thresholds = list(elig_cfg.get("tiers", [0.8, 0.6, 0.4, 0.2]))
    tier_multipliers = list(elig_cfg.get("tier_multipliers", [1.0, 0.8, 0.5, 0.2, 0.0]))
    # Sanity: ensure last multiplier exists
    if len(tier_multipliers) < len(tier_thresholds) + 1:
        # pad with zeros
        tier_multipliers = tier_multipliers + [0.0] * (len(tier_thresholds) + 1 - len(tier_multipliers))

    if use_weighted_eligibility:
        elig_scores = _combine_gates_weighted(plan, feat_tables, sentiment, pattern_cards_by_asset)

        # Apply weighted eligibility scores to base scores with hard-rule logic
        sc_now = {}
        for a in assets:
            base_score = float(scores_all[a].get(as_of, 0.0))
            eligibility = float(elig_scores.get(a, 0.0))

            if hard_from_custom and not hard_ok[a]:
                multiplier = 0.0 if zero_if_hard_fail else tier_multipliers[-1]
            else:
                # pick multiplier from tiers
                multiplier = tier_multipliers[-1]  # default lowest
                for th, mult in zip(tier_thresholds, tier_multipliers):
                    if eligibility >= th:
                        multiplier = mult
                        break
                # enforce floor if hard rules passed
                if hard_from_custom and hard_ok[a]:
                    multiplier = max(multiplier, floor_if_hard_ok)

            final_score = base_score * multiplier
            if final_score > 0:
                sc_now[a] = final_score

        if not sc_now:
            target = {a: 0.0 for a in assets}
        else:
            max_w = float(((plan.get("risk") or {}).get("max_weight", 0.40)))
            hard_cap = float(((plan.get("rebalance") or {}).get("hard_cap", 0.50)))
            strict_caps = bool(((plan.get("risk") or {}).get("strict_caps", True)))
            target = _weights_from_scores(sc_now, max_w=max_w, hard_cap=hard_cap, strict_caps=strict_caps)

        eligibility_output = elig_scores  # keep numeric for debug/consumers

    else:
        # Binary eligibility system
        soften_binary = bool(elig_cfg.get("soffen_non_hard_gates_in_binary", elig_cfg.get("soften_non_hard_gates_in_binary", True)))
        if soften_binary:
            # Only require hard rules; soft gates do not block eligibility
            eligible_assets = [a for a in assets if (not hard_from_custom) or hard_ok[a]]
        else:
            # Original: require all soft gates too
            elig = _combine_gates(plan, feat_tables, sentiment, pattern_cards_by_asset)
            eligible_assets = [a for a in assets if bool(elig[a].get(as_of, False)) and ((not hard_from_custom) or hard_ok[a])]

        if not eligible_assets:
            target = {a: 0.0 for a in assets}
        else:
            sc_now = {a: float(scores_all[a].get(as_of, 0.0)) for a in eligible_assets}
            max_w = float(((plan.get("risk") or {}).get("max_weight", 0.40)))
            hard_cap = float(((plan.get("rebalance") or {}).get("hard_cap", 0.50)))
            strict_caps = bool(((plan.get("risk") or {}).get("strict_caps", True)))
            target = _weights_from_scores(sc_now, max_w=max_w, hard_cap=hard_cap, strict_caps=strict_caps)

        # In binary mode, expose boolean eligibility (hard rule only if softened)
        if soften_binary:
            eligibility_output = {a: ((not hard_from_custom) or bool(hard_ok[a])) for a in assets}
        else:
            eligibility_output = {a: bool(elig[a].get(as_of, False)) for a in assets}  # type: ignore[name-defined]

    # Apply sentiment tilt for both systems
    tilt = float((plan.get("weighting") or {}).get("tilt_sentiment_pct", 0.0) or 0.0)
    if tilt > 0:
        sent_now = {}
        eligible_for_tilt = [a for a in assets if target.get(a, 0.0) > 0]
        for a in eligible_for_tilt:
            s = sentiment.get(a)
            if s is not None and not s.empty:
                try:
                    sent_now[a] = float(s.loc[:as_of].iloc[-1])
                except Exception:
                    pass
        if sent_now:
            max_w = float(((plan.get("risk") or {}).get("max_weight", 0.40)))
            hard_cap = float(((plan.get("rebalance") or {}).get("hard_cap", 0.50)))
            strict_caps = bool(((plan.get("risk") or {}).get("strict_caps", True)))
            target = _blend_tilt(target, sent_now, tilt, strict_caps, max_w, hard_cap)

    # Explain bullets per asset
    explain={}
    for a in assets:
        df = feat_tables[a].loc[:as_of]
        bullets=[]
        # SMA30 drift
        if "SMA_30" in df.columns and len(df["SMA_30"].dropna()):
            px  = df["close"].iloc[-1]
            sma = df["SMA_30"].iloc[-1]
            if pd.notna(px) and pd.notna(sma):
                pct = ((px/sma)-1)*100
                bullets.append(f"price {pct:+.1f}% vs SMA30")
        # Volume strength
        if "VOL_SMA_30" in df.columns and len(df["VOL_SMA_30"].dropna()):
            vs = df["VOL_SMA_30"].iloc[-1]; v = df["volume"].iloc[-1]
            if pd.notna(v) and pd.notna(vs) and vs>0:
                bullets.append(f"vol {v/vs:.2f}脳 avg")
        # ADX
        for col in [c for c in df.columns if c.startswith("ADX_")]:
            val = df[col].iloc[-1]
            if pd.notna(val):
                bullets.append(f"{col}={val:.1f}")
                break
        # BB BW% if present
        any_bw = [c for c in df.columns if c.startswith("BB_BW_PCT_")]
        if any_bw:
            v = df[any_bw[0]].iloc[-1]
            if pd.notna(v): bullets.append(f"bb_bw_pct {v:.2f}")
        # MACD hist sign
        any_mh = [c for c in df.columns if c.startswith("MACD_HIST_")]
        if any_mh:
            v = df[any_mh[0]].iloc[-1]
            if pd.notna(v): bullets.append(f"macd_hist {v:+.4f}")
        # Sentiment
        srow = 0.0
        if a in sentiment and not sentiment[a].empty:
            try:
                srow = float(sentiment[a].loc[:as_of].iloc[-1])
            except Exception:
                srow = 0.0
        bullets.append(f"sent {srow:+.2f}")
        # Pattern score
        if pattern_cards_by_asset and pattern_cards_by_asset.get(a):
            ps = _pattern_score_from_cards(pattern_cards_by_asset[a])
            bullets.append(f"pattern_score {ps:.2f}")
        # Hard rule status
        if plan.get("hard_rules"):
            bullets.append(f"hard_rules_pass={'Y' if hard_ok.get(a, True) else 'N'}")
        explain[a]=bullets

    out = {
        "as_of": as_of.isoformat(),
        "eligibility": eligibility_output,
        "scores": {a: float(scores_all[a].get(as_of, 0.0)) for a in assets},
        "target_weights": {a: float(target.get(a, 0.0)) for a in assets},
        "explain": explain,
        "features_used": feats_needed,
        "warnings": warnings
    }
    
    # Add weighted eligibility debug info if enabled
    if use_weighted_eligibility:
        out["weighted_eligibility_scores"] = {a: float(v) for a,v in (eligibility_output or {}).items()}  # type: ignore[arg-type]
    # Add hard rules pass map for transparency
    if plan.get("hard_rules"):
        out["hard_rules_pass"] = hard_ok

    # Optional: build trade plan
    if current_weights is not None and portfolio_value_usd is not None:
        band = float(((plan.get("rebalance") or {}).get("band_pp", 5.0)))
        tcap = float(((plan.get("rebalance") or {}).get("turnover_max", 0.15)))
        chunk = float(((plan.get("risk") or {}).get("order_max_usd", 2000.0)))
        slip  = int(((plan.get("risk") or {}).get("slippage_max_bps", 80)))
        out["trade_plan"] = plan_trades(
            current_w=current_weights,
            target_w=out["target_weights"],
            port_value_usd=float(portfolio_value_usd),
            band_pp=band, turnover_max=tcap, order_chunk_usd=chunk, slippage_bps=slip
        )

    return out