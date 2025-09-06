#!/usr/bin/env python3
"""
Executor Bot — multi‑vault, active, copy‑paste ready
===================================================

Fits your Blocks (1–15) without modifying others. It now:
- Monitors **multiple vaults** concurrently (sequential loop) via a config list
- Recomputes **live target weights each cycle** (uses Block 4 math directly) so
  crossovers (e.g., price falls below 30D SMA) trigger SELLs immediately — not
  only on weekly cadence — while still sharing a single source of truth
- Continuously checks bands, turnover, slippage, cooldown, and executes per plan
- Emits Safe‑ready calldata for Roles; or executes via EOA

Config (env)
------------
# Core
export RPC_URL="https://<rpc>"
export EXECUTION_MODE="DRY_RUN"   # DRY_RUN | EOA_DIRECT
export PRIVATE_KEY="<dev-key>"     # only for EOA_DIRECT
export CRYPTOPANIC_KEY="<api key>"
export UNIV3_ROUTER="0xE592427A0AEce92De3Edee1F18E0157C05861564"
export UNIV3_QUOTER="0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6"
export USDC="0xA0b8...eB48"
export CHAINLINK_FEEDS='{"USDC":"0x...","WETH":"0x...","WBTC":"0x...","WSOL":"0x0"}'

# Single‑vault (fallback) — same as before
export VAULT_ADDRESS="0xYourVault"
export VAULT_ALLOWED_TOKENS='{"USDC":"0x...","ETH":"0xWETH","BTC":"0xWBTC","SOL":"0xWSOL"}'
export PLAN_JSON_PATH="/path/plan.json"  # or set PLANNER_URL + PLAN_TEXT

# Multi‑vault (preferred)
# VAULTS_JSON is a JSON array of vault configs (see example below)
export VAULTS_JSON='[
  {
    "vault": "0xVault1",
    "allowed_tokens": {"USDC":"0x...","ETH":"0xWETH","BTC":"0xWBTC"},
    "plan": {"path": "/plans/v1.json"}
  },
  {
    "vault": "0xVault2",
    "allowed_tokens": {"USDC":"0x...","ETH":"0xWETH","SOL":"0xWSOL"},
    "plan": {"planner_url": "http://localhost:8001/plan", "text": "Basket ETH SOL price > 30D SMA and sentiment good"},
    "cooldown_hours": 3
  }
]'

Run
---
python agent/bot.py --once        # one cycle across all vaults
python agent/bot.py               # loop; interval via EXEC_INTERVAL (default 600s)
"""
from __future__ import annotations
import os, sys, json, time, logging, dataclasses
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Add parent directory to Python path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple
from datetime import datetime

from web3 import Web3
from web3.middleware import ExtraDataToPOAMiddleware
from eth_account import Account
from eth_typing import ChecksumAddress

# ──────────────────────────────────────────────────────────────────────────────
# Blocks 1/2/3/4: Planner → Data → Engine
# ──────────────────────────────────────────────────────────────────────────────
from services.planner.plan_analyzer import analyze_plan  # Block 2
from services.data.ohlcv import load_ohlcv               # Block 3
from services.data.sentiment import fetch_headlines, rolling_sentiment  # Block 3 - UPDATED FUNCTION NAMES
from engine.engine import (
    target_weights,        # NEW main function
    build_trade_plan,      # NEW trade planning function
    Plan                   # NEW Plan dataclass
)

# Optional: Block 14 monitoring hook
try:
    from services.monitoring.alerts import post_alert as _post_alert
except Exception:
    def _post_alert(title: str, body: str):
        pass

# --------------------------- Logging setup ----------------------------
LOG_LEVEL = os.environ.get("LOG_LEVEL", "INFO").upper()
logging.basicConfig(level=LOG_LEVEL, format="[%(asctime)s] %(levelname)s - %(message)s")
log = logging.getLogger("executor-bot")

# --------------------------- ABIs (minimal) ---------------------------
ERC20_ABI = [
    {"constant":True, "inputs":[], "name":"decimals","outputs":[{"name":"","type":"uint8"}], "stateMutability":"view","type":"function"},
    {"constant":True, "inputs":[], "name":"symbol","outputs":[{"name":"","type":"string"}], "stateMutability":"view","type":"function"},
    {"constant":True, "inputs":[{"name":"account","type":"address"}], "name":"balanceOf","outputs":[{"name":"","type":"uint256"}], "stateMutability":"view","type":"function"},
    {"constant":True, "inputs":[{"name":"owner","type":"address"},{"name":"spender","type":"address"}], "name":"allowance","outputs":[{"name":"","type":"uint256"}], "stateMutability":"view","type":"function"},
    {"constant":False, "inputs":[{"name":"spender","type":"address"},{"name":"amount","type":"uint256"}], "name":"approve","outputs":[{"name":"","type":"bool"}], "stateMutability":"nonpayable","type":"function"}
]

UNIV3_ROUTER_ABI = [
    {
      "inputs": [
        {"components": [
          {"internalType": "address", "name": "tokenIn", "type": "address"},
          {"internalType": "address", "name": "tokenOut", "type": "address"},
          {"internalType": "uint24",  "name": "fee", "type": "uint24"},
          {"internalType": "address", "name": "recipient", "type": "address"},
          {"internalType": "uint256","name": "deadline", "type": "uint256"},
          {"internalType": "uint256","name": "amountIn", "type": "uint256"},
          {"internalType": "uint256","name": "amountOutMinimum", "type": "uint256"},
          {"internalType": "uint160","name": "sqrtPriceLimitX96", "type": "uint160"}
        ], "internalType": "struct ISwapRouter.ExactInputSingleParams", "name": "params", "type": "tuple"}
      ],
      "name": "exactInputSingle",
      "outputs": [{"internalType": "uint256", "name": "amountOut", "type": "uint256"}],
      "stateMutability": "payable",
      "type": "function"
    }
]

UNIV3_QUOTER_ABI = [
    {
      "inputs": [
        {"internalType":"address","name":"tokenIn","type":"address"},
        {"internalType":"address","name":"tokenOut","type":"address"},
        {"internalType":"uint256","name":"amountIn","type":"uint256"},
        {"internalType":"uint24","name":"fee","type":"uint24"},
        {"internalType":"uint160","name":"sqrtPriceLimitX96","type":"uint160"}
      ],
      "name": "quoteExactInputSingle",
      "outputs": [{"internalType":"uint256","name":"amountOut","type":"uint256"}],
      "stateMutability": "nonpayable",
      "type": "function"
    }
]

CHAINLINK_AGG_ABI = [
    {"inputs":[],"name":"decimals","outputs":[{"internalType":"uint8","name":"","type":"uint8"}],"stateMutability":"view","type":"function"},
    {"inputs":[],"name":"latestRoundData","outputs":[
        {"internalType":"uint80","name":"roundId","type":"uint80"},
        {"internalType":"int256","name":"answer","type":"int256"},
        {"internalType":"uint256","name":"startedAt","type":"uint256"},
        {"internalType":"uint256","name":"updatedAt","type":"uint256"},
        {"internalType":"uint80","name":"answeredInRound","type":"uint80"}
    ],"stateMutability":"view","type":"function"}
]

# ---------------------------- Data classes ----------------------------
@dataclass
class SwapChunk:
    asset: str             # e.g. "ETH", "BTC", "SOL"
    side: str              # "BUY" or "SELL"
    usd: float
    slippage_bps: int
    fee_bps: int = 3000    # default pool fee 0.30%

@dataclass
class TokenInfo:
    symbol: str
    address: ChecksumAddress
    decimals: int

@dataclass
class VaultCfg:
    vault: str
    allowed_tokens: Dict[str,str]
    plan_path: Optional[str] = None
    planner_url: Optional[str] = None
    plan_text: Optional[str] = None
    cooldown_hours: Optional[int] = None

# ----------------------------- Utilities ------------------------------
def _json_env(name: str, default: Optional[str] = None) -> dict:
    val = os.environ.get(name, default)
    if not val:
        return {}
    try:
        return json.loads(val)
    except Exception:
        raise RuntimeError(f"ENV {name} must be JSON; got: {val}")

# --------------------------- On-chain helpers -------------------------
class Chain:
    def __init__(self, w3: Web3):
        self.w3 = w3
        try:
            self.w3.middleware_onion.inject(ExtraDataToPOAMiddleware, layer=0)
        except Exception:
            pass

    def erc20(self, addr: str):
        return self.w3.eth.contract(address=self.w3.to_checksum_address(addr), abi=ERC20_ABI)

    def router(self, addr: str):
        return self.w3.eth.contract(address=self.w3.to_checksum_address(addr), abi=UNIV3_ROUTER_ABI)

    def quoter(self, addr: str):
        return self.w3.eth.contract(address=self.w3.to_checksum_address(addr), abi=UNIV3_QUOTER_ABI)

    def chainlink(self, addr: str):
        return self.w3.eth.contract(address=self.w3.to_checksum_address(addr), abi=CHAINLINK_AGG_ABI)

# ----------------------------- Oracle (Block 9) -----------------------
class PriceOracle:
    """Primary: Chainlink; Fallback: Uniswap Quoter vs USDC."""
    def __init__(self, chain: Chain, chainlink_feeds: Dict[str, str], quoter_addr: str, usdc_addr: str):
        self.c = chain
        self.feeds = {k.upper(): self.c.w3.to_checksum_address(v) for k,v in chainlink_feeds.items() if v and v != '0x0000000000000000000000000000000000000000'}
        self.quoter = self.c.quoter(quoter_addr) if quoter_addr else None
        self.usdc = self.c.erc20(usdc_addr)
        self.usdc_decimals = self.usdc.functions.decimals().call()

    def price_usd(self, symbol: str, token_addr: str) -> float:
        sym = symbol.upper()
        if sym in self.feeds:
            agg = self.c.chainlink(self.feeds[sym])
            _rid, ans, _sa, updated, _a = agg.functions.latestRoundData().call()
            if int(ans) <= 0:
                raise RuntimeError(f"Chainlink non-positive for {sym}")
            dec = agg.functions.decimals().call()
            # stale log only (6h)
            if int(time.time()) - int(updated) > 6*3600:
                log.warning("Chainlink %s stale at %s", sym, updated)
            return float(ans) / (10 ** dec)
        if not self.quoter:
            raise RuntimeError(f"No Chainlink feed and Quoter not set for {sym}")
        token = self.c.erc20(token_addr)
        token_dec = token.functions.decimals().call()
        one_usdc = 10 ** self.usdc_decimals
        out = self.quoter.functions.quoteExactInputSingle(self.usdc.address, token_addr, one_usdc, 3000, 0).call()
        if int(out) == 0:
            raise RuntimeError(f"Quoter returned 0 for {sym}")
        return 1.0 / (out / (10 ** token_dec))

# -------------------------- Router (Block 8) --------------------------
class RouterClient:
    """Uniswap V3 exactInputSingle (EOA path). For Safe+Roles we emit calldata."""
    def __init__(self, chain: Chain, router_addr: str, account: Optional[Account], usdc_addr: str):
        self.c = chain
        self.router = self.c.router(router_addr)
        self.acct = account
        self.usdc = self.c.erc20(usdc_addr)
        self.usdc_decimals = self.usdc.functions.decimals().call()

    def _ensure_allowance(self, token, owner, spender, need: int):
        cur = token.functions.allowance(owner, spender).call()
        if cur >= need:
            return
        tx = token.functions.approve(spender, int(2**256 - 1)).build_transaction({
            'from': owner,
            'nonce': self.c.w3.eth.get_transaction_count(owner),
        })
        signed = self.c.w3.eth.account.sign_transaction(tx, private_key=self.acct.key)
        txh = self.c.w3.eth.send_raw_transaction(signed.rawTransaction)
        rcpt = self.c.w3.eth.wait_for_transaction_receipt(txh)
        if rcpt.status != 1:
            raise RuntimeError("ERC20 approve failed")
        log.info("Approved %s → %s", token.address, spender)

    def _build_params(self, token_in, token_out, recipient, amount_in, min_out, fee_bps=3000):
        return {
            'tokenIn': token_in,
            'tokenOut': token_out,
            'fee': int(fee_bps),
            'recipient': recipient,
            'deadline': int(time.time()) + 1200,
            'amountIn': int(amount_in),
            'amountOutMinimum': int(min_out),
            'sqrtPriceLimitX96': 0
        }

    def dryrun_payload(self, params: dict) -> dict:
        fn = self.router.get_function_by_name('exactInputSingle')
        data = fn(params).build_transaction({'from': '0x0000000000000000000000000000000000000000'})['data']
        return {'to': self.router.address, 'value': 0, 'data': data, 'operation': 0}

    def submit(self, params: dict) -> str:
        assert self.acct is not None, "EOA account required for EOA_DIRECT"
        owner = self.acct.address
        token_in = self.c.erc20(params['tokenIn'])
        self._ensure_allowance(token_in, owner, self.router.address, int(params['amountIn']))
        tx = self.router.functions.exactInputSingle(params).build_transaction({
            'from': owner,
            'nonce': self.c.w3.eth.get_transaction_count(owner),
            'value': 0,
        })
        signed = self.c.w3.eth.account.sign_transaction(tx, private_key=self.acct.key)
        txh = self.c.w3.eth.send_raw_transaction(signed.rawTransaction)
        rcpt = self.c.w3.eth.wait_for_transaction_receipt(txh)
        if rcpt.status != 1:
            raise RuntimeError(f"Swap failed: {txh.hex()}")
        log.info("Swap ok: %s", txh.hex())
        return txh.hex()

# --------------------------- Vault interface --------------------------
class VaultClient:
    """Read vault balances only (Blocks 6 & 7)."""
    def __init__(self, chain: Chain, vault_addr: str, allowed_tokens: Dict[str,str]):
        self.c = chain
        self.vault = self.c.w3.to_checksum_address(vault_addr)
        self.allowed = {k.upper(): self.c.w3.to_checksum_address(v) for k,v in allowed_tokens.items()}
        self.tokens: Dict[str, TokenInfo] = {}
        for sym, addr in self.allowed.items():
            t = self.c.erc20(addr)
            try:
                dec = int(t.functions.decimals().call())
            except Exception:
                dec = 18
            self.tokens[sym] = TokenInfo(sym, addr, dec)

    def balances(self) -> Dict[str, int]:
        out: Dict[str,int] = {}
        for sym, info in self.tokens.items():
            bal = self.c.erc20(info.address).functions.balanceOf(self.vault).call()
            out[sym] = int(bal)
        return out

# --------------------------- Single‑vault Executor --------------------
class Executor:
    def __init__(self,
                 w3: Web3,
                 plan: dict,
                 vault_addr: str,
                 allowed_tokens: Dict[str,str],
                 chainlink_feeds: Dict[str,str],
                 router_addr: str,
                 quoter_addr: str,
                 usdc_addr: str,
                 cp_key: str,
                 execution_mode: str = "DRY_RUN",
                 private_key: Optional[str] = None,
                 cooldown_hours: int = 6):
        self.c = Chain(w3)
        self.plan = plan
        self.vault = VaultClient(self.c, vault_addr, allowed_tokens)
        self.oracle = PriceOracle(self.c, chainlink_feeds, quoter_addr, usdc_addr)
        self.router = RouterClient(self.c, router_addr, Account.from_key(private_key) if (private_key and execution_mode=="EOA_DIRECT") else None, usdc_addr)
        self.cp_key = cp_key
        self.exec_mode = execution_mode
        self.cooldown_hours = cooldown_hours
        self.last_rebalance_ts: Optional[float] = None
        self.usdc_addr = self.c.w3.to_checksum_address(usdc_addr)

    # ---- Live target weights (Block 4 math directly; immediate crossover) ----
    def _live_target_weights(self) -> Tuple[Optional[datetime], Dict[str,float]]:
        meta = analyze_plan(self.plan)
        assets = meta["assets"]; days = meta["lookback_days"]
        
        # Data - Load OHLCV and sentiment using NEW function names
        ohlcv = {a: load_ohlcv(a, days) for a in assets}
        headlines = fetch_headlines(auth_token=self.cp_key)  # NEW function name
        sentiment = rolling_sentiment(headlines)             # NEW function name
        
        # Convert plan dict to Plan dataclass for new engine API
        plan_obj = Plan(
            regime=self.plan.get("regime", "auto"),
            direction_bias=self.plan.get("direction_bias", "neutral"),
            universe=assets,
            gates=self.plan.get("gates", {}),
            custom_rules=self.plan.get("custom_rules", []),
            weighting=self.plan.get("weighting", {}),
            rebalance=self.plan.get("rebalance", {}),
            risk=self.plan.get("risk", {}),
            execution=self.plan.get("execution", {}),
            sentiment_cfg=self.plan.get("sentiment_cfg", {})
        )
        
        # NEW ENGINE API - Single function call does everything
        weights, explains = target_weights(plan_obj, ohlcv, sentiment)
        
        # Get latest timestamp
        t = max(df.index.max() for df in ohlcv.values()) if ohlcv else None
        
        # Ensure all assets have weights (fill missing with 0)
        for a in assets:
            if a not in weights:
                weights[a] = 0.0
                
        return t, weights

    # -------------- Holdings -> current weights (Blocks 6/9) ------------------
    def _current_weights(self) -> Tuple[Dict[str,float], float, Dict[str,int]]:
        bals = self.vault.balances()
        total_usd = 0.0
        usd_values: Dict[str,float] = {}
        for sym, raw in bals.items():
            info = self.vault.tokens[sym]
            px = 1.0 if sym.upper()=="USDC" else self.oracle.price_usd(sym, info.address)
            qty = raw / (10 ** info.decimals)
            usd = qty * px
            usd_values[sym] = usd
            total_usd += usd
        if total_usd <= 0:
            return {k: 0.0 for k in self.vault.tokens.keys()}, 0.0, bals
        weights = {k: (v/total_usd) for k,v in usd_values.items()}
        return weights, total_usd, bals

    def _cooldown_ok(self) -> bool:
        return (self.last_rebalance_ts is None) or ((time.time() - self.last_rebalance_ts) >= self.cooldown_hours*3600)

    # -------------------- (Block 4) Order planning ---------------------------
    def _build_orders(self, target_w: Dict[str,float], cur_w: Dict[str,float], port_usd: float) -> List[SwapChunk]:
        # NEW ENGINE API - build_trade_plan returns simple {asset: usd_amount} dict
        trade_plan = build_trade_plan(
            cur_w, 
            target_w, 
            port_usd, 
            band_pp=self.plan["rebalance"]["band_pp"]
        )
        
        # Convert to SwapChunk format
        orders = []
        for asset, usd_amount in trade_plan.items():
            if abs(usd_amount) > 1.0:  # Minimum trade size threshold
                side = "BUY" if usd_amount > 0 else "SELL"
                orders.append(SwapChunk(
                    asset=asset,
                    side=side,
                    usd=abs(usd_amount),
                    slippage_bps=self.plan["risk"]["slippage_max_bps"]
                ))
        
        return orders

    # -------------- Quote + calldata helpers (Block 8 / 7 integration) -------
    def _token_of(self, sym: str) -> TokenInfo:
        s = sym.upper(); assert s in self.vault.tokens, f"Unknown token {sym}"
        return self.vault.tokens[s]

    def _amounts_for_order(self, od: SwapChunk) -> Tuple[int,int,ChecksumAddress,ChecksumAddress]:
        t_asset = self._token_of(od.asset)
        usdc = self._token_of("USDC")
        sl = od.slippage_bps / 10_000.0
        if od.side == "BUY":
            amount_in = int(round(od.usd * (10 ** usdc.decimals)))
            try:
                quoted = self.oracle.quoter.functions.quoteExactInputSingle(usdc.address, t_asset.address, amount_in, od.fee_bps, 0).call()
            except Exception:
                px = self.oracle.price_usd(od.asset, t_asset.address)
                quoted = int((od.usd / px) * (10 ** t_asset.decimals))
            min_out = int(quoted * (1 - sl))
            return amount_in, min_out, usdc.address, t_asset.address
        else:
            px = self.oracle.price_usd(od.asset, t_asset.address)
            amount_in = int((od.usd / px) * (10 ** t_asset.decimals))
            expected_out = int(round(od.usd * (10 ** usdc.decimals)))
            min_out = int(expected_out * (1 - sl))
            return amount_in, min_out, t_asset.address, usdc.address

    # -------------------- Execute (Block 8; Block 7 payloads) ----------------
    def _execute_orders(self, orders: List[SwapChunk]):
        if not orders:
            log.info("No trades — bands not triggered.")
            return
        log.info("Planned %d orders", len(orders))
        for od in orders:
            remain = float(od.usd)
            chunk_usd = self.plan["risk"]["order_max_usd"]
            i = 0
            while remain > 1e-6:
                usd = min(remain, chunk_usd); i += 1
                a_in, min_out, token_in, token_out = self._amounts_for_order(dataclasses.replace(od, usd=usd))
                params = self.router._build_params(token_in, token_out, recipient=self.vault.vault, amount_in=a_in, min_out=min_out, fee_bps=od.fee_bps)
                # Emit Safe‑ready payload (Block 7)
                payload = self.router.dryrun_payload(params)
                log.info("SAFE_PAYLOAD %s", json.dumps({"to": payload['to'], "data": payload['data'], "value": payload['value'], "op": payload['operation'], "note": f"{od.side} {od.asset} ${usd:.2f}"}))
                if self.exec_mode == "DRY_RUN":
                    log.info("DRY_RUN [%s %s $%.2f #%d]", od.side, od.asset, usd, i)
                elif self.exec_mode == "EOA_DIRECT":
                    txh = self.router.submit(params)
                    log.info("Executed chunk #%d %s %s $%.2f tx=%s", i, od.side, od.asset, usd, txh)
                else:
                    raise RuntimeError(f"Unsupported EXECUTION_MODE={self.exec_mode}")
                remain -= usd
        self.last_rebalance_ts = time.time()

    # -------------------- Public entrypoints -------------------------
    def run_once(self):
        try:
            t, target = self._live_target_weights()
            log.info("Live target @ %s: %s", t, {k: round(v,4) for k,v in target.items()})
            cur_w, port_usd, _ = self._current_weights()
            log.info("Portfolio USD=%.2f | Current=%s", port_usd, {k: round(v,4) for k,v in cur_w.items()})
            orders = self._build_orders(target_w=target, cur_w=cur_w, port_usd=port_usd or 1.0)
            if not self._cooldown_ok():
                log.info("Cooldown active; skip execution")
                return
            self._execute_orders(orders)
            log.info("NAV (est) ≈ $%.2f", port_usd)
        except Exception as e:
            _post_alert("BOT_ERROR", f"{type(e).__name__}: {e}")
            log.exception("Executor error")

# --------------------------- Multi‑vault runner -----------------------
class MultiVaultExecutor:
    def __init__(self, w3: Web3, base_cfg: dict, vaults: List[VaultCfg]):
        self.w3 = w3
        self.base = base_cfg
        self.vcfgs = vaults
        self.executors: List[Executor] = []
        for v in self.vcfgs:
            # Load plan per vault
            plan = self._load_plan(v)
            ex = Executor(
                w3,
                plan=plan,
                vault_addr=v.vault,
                allowed_tokens=v.allowed_tokens,
                chainlink_feeds=self.base['chainlink_feeds'],
                router_addr=self.base['router'],
                quoter_addr=self.base['quoter'],
                usdc_addr=self.base['usdc'],
                cp_key=self.base.get('cp_key',''),
                execution_mode=self.base['mode'],
                private_key=self.base.get('private_key'),
                cooldown_hours=v.cooldown_hours or self.base.get('cooldown_hours', 6)
            )
            self.executors.append(ex)

    def _load_plan(self, v: VaultCfg) -> dict:
        if v.plan_path:
            with open(v.plan_path,'r') as f: return json.load(f)
        if v.planner_url and v.plan_text:
            import requests
            r = requests.post(v.planner_url, json={'text': v.plan_text}, timeout=30)
            r.raise_for_status(); return r.json()
        # fallback minimal plan
        return {
            "name":"Auto","universe": list(v.allowed_tokens.keys()),
            "gates":{"all_of":[{"expr":"CLOSE > SMA(30)"},{"expr":"SENTIMENT >= 0.30"}],"any_of":[]},
            "weighting":{"mode":"composite"},
            "rebalance":{"cadence":"weekly","band_pp":5.0,"turnover_max":0.15,"hard_cap":0.50},
            "risk":{"max_weight":0.40,"slippage_max_bps":80,"order_max_usd":2000,"cooldown_hours":6}
        }

    def run_once(self):
        for ex in self.executors:
            log.info("=== Vault %s ===", ex.vault.vault)
            ex.run_once()

    def run_loop(self, interval_sec: int = 600):
        while True:
            self.run_once()
            time.sleep(interval_sec)

# ------------------------------ CLI -----------------------------------
if __name__ == "__main__":
    import argparse
    p = argparse.ArgumentParser(description="Executor Bot (multi‑vault; EOA or Dry‑Run)")
    p.add_argument('--once', action='store_true', help='Run a single cycle and exit')
    p.add_argument('--interval', type=int, default=int(os.environ.get('EXEC_INTERVAL', '600')), help='Loop interval seconds')
    p.add_argument('--plan', type=str, default=os.environ.get('PLAN_JSON_PATH', ''), help='Path to plan.json (single‑vault fallback)')
    p.add_argument('--planner-url', type=str, default=os.environ.get('PLANNER_URL', ''), help='Planner URL (single‑vault fallback)')
    p.add_argument('--text', type=str, default=os.environ.get('PLAN_TEXT', ''), help='Planner text (single‑vault fallback)')
    args = p.parse_args()

    # Web3
    rpc = os.environ.get('RPC_URL'); assert rpc, 'RPC_URL is required'
    w3 = Web3(Web3.HTTPProvider(rpc))

    # Base config
    mode = os.environ.get('EXECUTION_MODE', 'DRY_RUN').upper()
    pk = os.environ.get('PRIVATE_KEY') if mode == 'EOA_DIRECT' else None
    base_cfg = {
        'mode': mode,
        'private_key': pk,
        'router': os.environ.get('UNIV3_ROUTER'),
        'quoter': os.environ.get('UNIV3_QUOTER'),
        'usdc': os.environ.get('USDC'),
        'chainlink_feeds': _json_env('CHAINLINK_FEEDS'),
        'cp_key': os.environ.get('CRYPTOPANIC_KEY',''),
        'cooldown_hours':  int(os.environ.get('DEFAULT_COOLDOWN_HOURS','6')),
    }
    assert base_cfg['router'] and base_cfg['quoter'] and base_cfg['usdc'], 'UNIV3_ROUTER/UNIV3_QUOTER/USDC required'
    if mode == 'EOA_DIRECT' and not pk:
        raise SystemExit('EOA_DIRECT requires PRIVATE_KEY in env')

    # Multi‑vault config via VAULTS_JSON (preferred)
    vlist_env = os.environ.get('VAULTS_JSON','')
    vaults: List[VaultCfg] = []
    if vlist_env:
        raw = json.loads(vlist_env)
        for item in raw:
            vaults.append(VaultCfg(
                vault=item['vault'],
                allowed_tokens=item['allowed_tokens'],
                plan_path=(item.get('plan') or {}).get('path'),
                planner_url=(item.get('plan') or {}).get('planner_url'),
                plan_text=(item.get('plan') or {}).get('text'),
                cooldown_hours=item.get('cooldown_hours')
            ))
    else:
        # Single‑vault fallback from legacy envs
        vaddr = os.environ.get('VAULT_ADDRESS') or '<vault>'
        allowed_tokens = _json_env('VAULT_ALLOWED_TOKENS') or {
            "USDC": os.environ.get('USDC','<usdc>'),
            "ETH": os.environ.get('WETH','<weth>'),
            "BTC": os.environ.get('WBTC','<wbtc>'),
            "SOL": os.environ.get('WSOL','<wsol>')
        }
        # Load plan if provided
        plan_path = args.plan if (args.plan and os.path.exists(args.plan)) else None
        planner_url = args.planner_url
        plan_text = args.text
        vaults = [VaultCfg(vault=vaddr, allowed_tokens=allowed_tokens, plan_path=plan_path, planner_url=planner_url, plan_text=plan_text)]

    runner = MultiVaultExecutor(w3, base_cfg, vaults)
    if args.once:
        runner.run_once()
    else:
        runner.run_loop(interval_sec=args.interval)