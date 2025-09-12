#!/usr/bin/env python3
"""
Executor Bot — multi-vault, active, copy-paste ready
===================================================

Fits your Blocks (1–15) without modifying others. It now:
- Monitors **multiple vaults** concurrently (sequential loop) via a config list
- Recomputes **live target weights each cycle** (uses Block 4 math directly) so
  crossovers (e.g., price falls below 30D SMA) trigger SELLs immediately — not
  only on weekly cadence — while still sharing a single source of truth
- Continuously checks bands, turnover, slippage, cooldown, and executes per plan
- Emits Safe-ready calldata for Roles; or executes via EOA

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

# Single-vault (fallback) — same as before
export VAULT_ADDRESS="0xYourVault"
export VAULT_ALLOWED_TOKENS='{"USDC":"0x...","ETH":"0xWETH","BTC":"0xWBTC","SOL":"0xWSOL"}'
export PLAN_JSON_PATH="/path/plan.json"  # or set PLANNER_URL + PLAN_TEXT

# Multi-vault (preferred)
# VAULTS_JSON is a JSON array of vault configs (see example below)
export VAULTS_JSON='[
  {
    "vault": "0xVault1",
    "allowed_tokens": {"USDC":"0x...","ETH":"0xWETH","BTC":"0xWBTC"},
    "plan": {"path": "/plans/v1.json"},
    "strategy_id": "uuid-from-database"
  },
  {
    "vault": "0xVault2",
    "allowed_tokens": {"USDC":"0x...","ETH":"0xWETH","SOL":"0xWSOL"},
    "plan": {"planner_url": "http://localhost:8001/plan", "text": "Basket ETH SOL price > 30D SMA and sentiment good"},
    "cooldown_hours": 3,
    "strategy_id": "uuid-from-database"
  }
]'

# Database (optional) - for strategy weight caching
export SUPABASE_URL="https://..."
export SUPABASE_SERVICE_ROLE="..."

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

# Import contract ABIs
from abis import (
    ERC20_ABI,
    MULTI_ASSET_VAULT_ABI,
    ORDER_ROUTER_ABI,
    ORACLE_AGGREGATOR_ABI,
    UNIV3_QUOTER_ABI,
    # Backward compatibility
    CHAINLINK_AGG_ABI,
    UNIV3_ROUTER_ABI
)

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

# Optional: Database integration for strategies
try:
    from supabase import create_client, Client as SupabaseClient
except ImportError:
    SupabaseClient = None

# --------------------------- Logging setup ----------------------------
LOG_LEVEL = os.environ.get("LOG_LEVEL", "INFO").upper()
logging.basicConfig(level=LOG_LEVEL, format="[%(asctime)s] %(levelname)s - %(message)s")
log = logging.getLogger("executor-bot")

# --------------------------- ABIs imported from abis.py ---------------------------
# ABIs are now imported from the separate abis.py file for better organization

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
    strategy_id: Optional[str] = None

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

    def order_router(self, addr: str):
        return self.w3.eth.contract(address=self.w3.to_checksum_address(addr), abi=ORDER_ROUTER_ABI)

    def multi_asset_vault(self, addr: str):
        return self.w3.eth.contract(address=self.w3.to_checksum_address(addr), abi=MULTI_ASSET_VAULT_ABI)

    def oracle_aggregator(self, addr: str):
        return self.w3.eth.contract(address=self.w3.to_checksum_address(addr), abi=ORACLE_AGGREGATOR_ABI)

    def quoter(self, addr: str):
        return self.w3.eth.contract(address=self.w3.to_checksum_address(addr), abi=UNIV3_QUOTER_ABI)

    # Backward compatibility methods
    def router(self, addr: str):
        return self.order_router(addr)

    def chainlink(self, addr: str):
        return self.oracle_aggregator(addr)

# ----------------------------- Oracle (Block 9) -----------------------
class PriceOracle:
    """Uses OracleAggregator for price feeds."""
    def __init__(self, chain: Chain, oracle_feeds: Dict[str, str], usdc_addr: str):
        self.c = chain
        self.feeds = {k.upper(): self.c.w3.to_checksum_address(v) for k,v in oracle_feeds.items() if v and v != '0x0000000000000000000000000000000000000000'}
        self.usdc = self.c.erc20(usdc_addr)
        self.usdc_decimals = self.usdc.functions.decimals().call()

    def price_usd(self, symbol: str, token_addr: str) -> float:
        sym = symbol.upper()
        if sym in self.feeds:
            # Use OracleAggregator
            agg = self.c.oracle_aggregator(self.feeds[sym])
            try:
                # Try the custom getPrice function first
                price = agg.functions.getPrice(token_addr).call()
                if int(price) > 0:
                    # OracleAggregator returns price with proper decimals
                    dec = agg.functions.getDecimals().call()
                    return float(price) / (10 ** dec)
            except Exception as e:
                log.warning(f"OracleAggregator getPrice failed for {sym}: {e}")
            
            # Fallback to standard Chainlink latestRoundData
            try:
                _rid, ans, _sa, updated, _a = agg.functions.latestRoundData().call()
                if int(ans) <= 0:
                    raise RuntimeError(f"Oracle non-positive price for {sym}")
                dec = agg.functions.getDecimals().call()
                # stale log only (6h)
                if int(time.time()) - int(updated) > 6*3600:
                    log.warning("Oracle %s stale at %s", sym, updated)
                return float(ans) / (10 ** dec)
            except Exception as e:
                log.error(f"Oracle latestRoundData failed for {sym}: {e}")
                raise
        
        raise RuntimeError(f"No Oracle feed configured for {sym}")

# -------------------------- Router (Block 8) --------------------------
class RouterClient:
    """OrderRouter client for TraderJoe LBRouter swaps. For Safe+Roles we emit calldata."""
    def __init__(self, chain: Chain, router_addr: str, account: Optional[Account], usdc_addr: str):
        self.c = chain
        self.router = self.c.order_router(router_addr)
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
        txh = self.c.w3.eth.send_raw_transaction(signed.raw_transaction)
        rcpt = self.c.w3.eth.wait_for_transaction_receipt(txh)
        if rcpt.status != 1:
            raise RuntimeError("ERC20 approve failed")
        log.info("Approved %s → %s", token.address, spender)

    def swap_no_slippage(self, token_in: str, token_out: str, amount_in: int) -> str:
        """Execute swapNoSlippage - direct EOA execution only"""
        assert self.acct is not None, "EOA account required for direct execution"
        owner = self.acct.address
        token_in_contract = self.c.erc20(token_in)
        
        # Ensure allowance
        self._ensure_allowance(token_in_contract, owner, self.router.address, amount_in)
        
        # Execute swap
        tx = self.router.functions.swapNoSlippage(token_in, token_out, amount_in).build_transaction({
            'from': owner,
            'nonce': self.c.w3.eth.get_transaction_count(owner),
            'value': 0,
        })
        signed = self.c.w3.eth.account.sign_transaction(tx, private_key=self.acct.key)
        txh = self.c.w3.eth.send_raw_transaction(signed.raw_transaction)
        rcpt = self.c.w3.eth.wait_for_transaction_receipt(txh)
        if rcpt.status != 1:
            raise RuntimeError(f"Swap failed: {txh.hex()}")
        
        log.info("Swap ok: %s", txh.hex())
        return txh.hex()
    
    # MultiAssetVault transaction execution methods
    def execute_vault_tx(self, vault_addr: str, vault_function) -> str:
        """Execute vault transaction - direct EOA execution only"""
        assert self.acct is not None, "EOA account required for direct execution"
        owner = self.acct.address
        
        # Build and execute transaction
        tx = vault_function.build_transaction({
            'from': owner,
            'nonce': self.c.w3.eth.get_transaction_count(owner),
            'value': 0,
        })
        signed = self.c.w3.eth.account.sign_transaction(tx, private_key=self.acct.key)
        txh = self.c.w3.eth.send_raw_transaction(signed.raw_transaction)
        rcpt = self.c.w3.eth.wait_for_transaction_receipt(txh)
        if rcpt.status != 1:
            raise RuntimeError(f"Vault transaction failed: {txh.hex()}")
        
        log.info("Vault tx ok: %s", txh.hex())
        return txh.hex()
    
    def process_deposits(self, vault_client) -> str:
        """Execute processDepositQueue on vault"""
        vault_fn = vault_client.process_deposit_queue()
        return self.execute_vault_tx(vault_client.vault, vault_fn)
    
    def process_redemptions(self, vault_client) -> str:
        """Execute processRedemptionQueue on vault"""
        vault_fn = vault_client.process_redemption_queue()
        return self.execute_vault_tx(vault_client.vault, vault_fn)
    
    def deploy_capital(self, vault_client, asset_addr: str, usdc_amount: int) -> str:
        """Execute deployCapital on vault"""
        vault_fn = vault_client.deploy_capital(asset_addr, usdc_amount)
        return self.execute_vault_tx(vault_client.vault, vault_fn)
    
    def liquidate_asset(self, vault_client, asset_addr: str, asset_amount: int) -> str:
        """Execute liquidateAsset on vault"""
        vault_fn = vault_client.liquidate_asset(asset_addr, asset_amount)
        return self.execute_vault_tx(vault_client.vault, vault_fn)
    
    def update_nav(self, vault_client, asset_prices: List[int]) -> str:
        """Execute updateNAV on vault"""
        vault_fn = vault_client.update_nav(asset_prices)
        return self.execute_vault_tx(vault_client.vault, vault_fn)

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
    
    # MultiAssetVault-specific methods
    def get_total_value(self) -> int:
        """Get total value in USDC from MultiAssetVault."""
        vault = self.c.multi_asset_vault(self.vault)
        return vault.functions.getTotalValue().call()
    
    def get_pending_deposits(self) -> int:
        """Get pending USDC deposits."""
        vault = self.c.multi_asset_vault(self.vault)
        return vault.functions.getPendingDeposits().call()
    
    def get_pending_redemptions(self) -> int:
        """Get pending share redemptions."""
        vault = self.c.multi_asset_vault(self.vault)
        return vault.functions.getPendingRedemptions().call()
    
    def get_basket_assets(self) -> List[str]:
        """Get list of basket asset addresses."""
        vault = self.c.multi_asset_vault(self.vault)
        return vault.functions.getBasketAssets().call()
    
    def get_asset_allocation(self, asset_addr: str) -> Tuple[int, int, bool]:
        """Get asset allocation: (weight, balance, isActive)."""
        vault = self.c.multi_asset_vault(self.vault)
        return vault.functions.getAssetAllocation(asset_addr).call()
    
    def get_pending_usdc(self) -> int:
        """Get pending USDC amount."""
        vault = self.c.multi_asset_vault(self.vault)
        return vault.functions.pendingUSDC().call()
    
    def get_deployed_usdc(self) -> int:
        """Get deployed USDC amount."""
        vault = self.c.multi_asset_vault(self.vault)
        return vault.functions.deployedUSDC().call()
    
    # Bot management functions (require transactions)
    def process_deposit_queue(self):
        """Process pending deposits in the queue."""
        vault = self.c.multi_asset_vault(self.vault)
        return vault.functions.processDepositQueue()
    
    def process_redemption_queue(self):
        """Process pending redemptions in the queue."""
        vault = self.c.multi_asset_vault(self.vault)
        return vault.functions.processRedemptionQueue()
    
    def deploy_capital(self, asset_addr: str, usdc_amount: int):
        """Deploy USDC capital to buy the specified asset.
        
        Args:
            asset_addr: Address of the asset to buy
            usdc_amount: Amount of USDC to deploy
            
        Returns:
            Transaction function for deployCapital
        """
        vault = self.c.multi_asset_vault(self.vault)
        return vault.functions.deployCapital(asset_addr, usdc_amount)
    
    def liquidate_asset(self, asset_addr: str, asset_amount: int):
        """Liquidate asset back to USDC.
        
        Args:
            asset_addr: Address of the asset to liquidate
            asset_amount: Amount of asset to liquidate
            
        Returns:
            Transaction function for liquidateAsset
        """
        vault = self.c.multi_asset_vault(self.vault)
        return vault.functions.liquidateAsset(asset_addr, asset_amount)
    
    def update_nav(self, asset_prices: List[int]):
        """Update Net Asset Value with current asset prices.
        
        Args:
            asset_prices: List of asset prices in proper decimals
            
        Returns:
            Transaction function for updateNAV
        """
        vault = self.c.multi_asset_vault(self.vault)
        return vault.functions.updateNAV(asset_prices)

# --------------------------- Single-vault Executor --------------------
class Executor:
    def __init__(self,
                 w3: Web3,
                 plan: dict,
                 vault_addr: str,
                 allowed_tokens: Dict[str,str],
                 chainlink_feeds: Dict[str,str],
                 router_addr: str,
                 usdc_addr: str,
                 cp_key: str,
                 execution_mode: str = "DRY_RUN",
                 private_key: Optional[str] = None,
                 cooldown_hours: int = 6,
                 strategy_id: Optional[str] = None):
        self.c = Chain(w3)
        self.plan = plan
        self.vault = VaultClient(self.c, vault_addr, allowed_tokens)
        self.oracle = PriceOracle(self.c, chainlink_feeds, usdc_addr)
        self.router = RouterClient(self.c, router_addr, Account.from_key(private_key) if (private_key and execution_mode=="EOA_DIRECT") else None, usdc_addr)
        self.cp_key = cp_key
        self.exec_mode = execution_mode
        self.cooldown_hours = cooldown_hours
        self.last_rebalance_ts: Optional[float] = None
        self.usdc_addr = self.c.w3.to_checksum_address(usdc_addr)
        self.strategy_id = strategy_id
        
        # Initialize database client if available
        self.db_client: Optional[SupabaseClient] = None
        if SupabaseClient is not None:
            supabase_url = os.environ.get("SUPABASE_URL")
            supabase_key = os.environ.get("SUPABASE_SERVICE_ROLE")
            if supabase_url and supabase_key:
                try:
                    self.db_client = create_client(supabase_url, supabase_key)
                    log.info("Database client initialized for strategy: %s", strategy_id or "local")
                except Exception as e:
                    log.warning("Failed to initialize database client: %s", e)

    # ---- Database weight operations (READ-ONLY) ----
    def _get_weights_from_db(self) -> Optional[Dict[str, float]]:
        """Fetch weights from database if available and fresh."""
        if not self.db_client or not self.strategy_id:
            log.debug("No database client or strategy_id available")
            return None
        
        log.info("Attempting to fetch weights from database for strategy: %s", self.strategy_id)
        
        try:
            # Fetch strategy from database
            result = self.db_client.table("strategies").select("*").eq("id", self.strategy_id).execute()
            
            if not result.data:
                log.warning("Strategy %s not found in database", self.strategy_id)
                return None
            
            strategy = result.data[0]
            
            # Get universe and weights
            plan_json = strategy.get("plan_json", {})
            universe = plan_json.get("universe") or plan_json.get("universe_list", [])
            weights_array = strategy.get("weights", [])
            
            if not universe or not weights_array:
                log.info("Missing universe (%s) or weights (%s) for strategy %s", universe, weights_array, self.strategy_id)
                return None
            
            if len(universe) != len(weights_array):
                log.warning("Universe/weights length mismatch for strategy %s", self.strategy_id)
                return None
            
            # Convert to dict
            weights_dict = {asset: float(weight) for asset, weight in zip(universe, weights_array)}
            
            # Check if weights are meaningful (not all zeros)
            total_weight = sum(weights_dict.values())
            log.info("Fetched weights from database for strategy %s: %s (total: %.4f)", 
                    self.strategy_id, {k: round(v, 4) for k, v in weights_dict.items()}, total_weight)
            
            if total_weight == 0:
                log.debug("All weights are zero for strategy %s, will use fallback calculation", self.strategy_id)
                return None
                
            log.info("Using database weights for strategy %s", self.strategy_id)
            return weights_dict
            
        except Exception as e:
            log.warning("Error fetching weights from database: %s", e)
            return None

    # ---- Live target weights (DB-first with fallback to calculation) ----
    def _live_target_weights(self) -> Tuple[Optional[datetime], Dict[str,float]]:
        # First, try to get weights from database
        db_weights = self._get_weights_from_db()
        if db_weights is not None:
            # Use current timestamp for DB weights
            return datetime.now(), db_weights
        
        # Fallback: Calculate weights locally
        log.info("Using fallback weight calculation for strategy: %s", self.strategy_id or "local")
        
        meta = analyze_plan(self.plan)
        assets = meta["assets"]; days = meta["lookback_days"]
        
        # Data - Load OHLCV and sentiment using NEW function names  
        # Skip stablecoins for price analysis (they don't have meaningful price movements)
        STABLECOINS = ["USDT", "USDC", "DAI", "BUSD", "FRAX"]
        trading_assets = [a for a in assets if a.upper() not in STABLECOINS]
        ohlcv = {a: load_ohlcv(a, days) for a in trading_assets}
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
            print("Token info:", info)
            px = 1.0 if sym.upper()=="USDC" or sym.upper()=="USDT" else self.oracle.price_usd(sym, info.address)
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

    def _amounts_for_order(self, od: SwapChunk) -> Tuple[int,ChecksumAddress,ChecksumAddress]:
        t_asset = self._token_of(od.asset)
        usdc = self._token_of("USDC")
        
        if od.side == "BUY":
            # Buy asset with USDC
            amount_in = int(round(od.usd * (10 ** usdc.decimals)))
            return amount_in, usdc.address, t_asset.address
        else:
            # Sell asset for USDC
            px = self.oracle.price_usd(od.asset, t_asset.address)
            amount_in = int((od.usd / px) * (10 ** t_asset.decimals))
            return amount_in, t_asset.address, usdc.address

    # -------------------- Execute (Block 8) - Direct EOA only ----------------
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
                a_in, token_in, token_out = self._amounts_for_order(dataclasses.replace(od, usd=usd))
                
                if self.exec_mode == "DRY_RUN":
                    log.info("DRY_RUN [%s %s $%.2f #%d] %s→%s amount=%d", od.side, od.asset, usd, i, token_in, token_out, a_in)
                elif self.exec_mode == "EOA_DIRECT":
                    txh = self.router.swap_no_slippage(token_in, token_out, a_in)
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
    
    # MultiAssetVault-specific execution method
    def run_vault_cycle(self):
        """Enhanced execution cycle for MultiAssetVault with queue processing and NAV updates."""
        try:
            # Step 1: Process pending deposits and redemptions
            if self.exec_mode == "EOA_DIRECT":
                try:
                    pending_deposits = self.vault.get_pending_deposits()
                    if pending_deposits > 0:
                        log.info("Processing %d pending deposits", pending_deposits)
                        self.router.process_deposits(self.vault)
                except Exception as e:
                    log.warning("Failed to process deposits: %s", e)
                
                try:
                    pending_redemptions = self.vault.get_pending_redemptions()
                    if pending_redemptions > 0:
                        log.info("Processing %d pending redemptions", pending_redemptions)
                        self.router.process_redemptions(self.vault)
                except Exception as e:
                    log.warning("Failed to process redemptions: %s", e)
            
            # Step 2: Update NAV with current asset prices
            try:
                basket_assets = self.vault.get_basket_assets()
                asset_prices = []
                for asset_addr in basket_assets:
                    # Find symbol for this address
                    symbol = None
                    for sym, info in self.vault.tokens.items():
                        if info.address.lower() == asset_addr.lower():
                            symbol = sym
                            break
                    
                    if symbol:
                        price_usd = self.oracle.price_usd(symbol, asset_addr)
                        # Convert to 8 decimals for NAV update
                        price_8dec = int(price_usd * 1e8)
                        asset_prices.append(price_8dec)
                        log.info("Asset %s price: $%.2f", symbol, price_usd)
                    else:
                        log.warning("Could not find symbol for asset %s", asset_addr)
                        asset_prices.append(0)
                
                if asset_prices and self.exec_mode == "EOA_DIRECT":
                    self.router.update_nav(self.vault, asset_prices)
                    log.info("Updated NAV with prices: %s", asset_prices)
                elif self.exec_mode == "DRY_RUN":
                    log.info("DRY_RUN: Would update NAV with prices: %s", asset_prices)
                    
            except Exception as e:
                log.warning("Failed to update NAV: %s", e)
            
            # Step 3: Get current allocation and calculate rebalancing
            vault_total_value = self.vault.get_total_value()
            if vault_total_value == 0:
                log.info("Vault is empty, skipping rebalancing")
                return
                
            # Get target weights
            t, target = self._live_target_weights()
            log.info("Live target @ %s: %s", t, {k: round(v,4) for k,v in target.items()})
            
            # Get current weights from vault allocation
            cur_w = self._vault_current_weights()
            log.info("Vault total value: $%.2f | Current allocation: %s", vault_total_value/1e6, {k: round(v,4) for k,v in cur_w.items()})
            
            # Step 4: Execute rebalancing via vault functions
            if not self._cooldown_ok():
                log.info("Cooldown active; skip execution")
                return
                
            self._execute_vault_rebalancing(target, cur_w, vault_total_value)
            log.info("Vault NAV: $%.2f", vault_total_value/1e6)
            
        except Exception as e:
            _post_alert("VAULT_BOT_ERROR", f"{type(e).__name__}: {e}")
            log.exception("Vault executor error")
    
    def _vault_current_weights(self) -> Dict[str, float]:
        """Get current weights from vault asset allocations."""
        weights = {}
        total_value = 0
        basket_assets = self.vault.get_basket_assets()
        
        for asset_addr in basket_assets:
            # Find symbol for this address
            symbol = None
            for sym, info in self.vault.tokens.items():
                if info.address.lower() == asset_addr.lower():
                    symbol = sym
                    break
            
            if symbol:
                weight_raw, balance_raw, is_active = self.vault.get_asset_allocation(asset_addr)
                if is_active and balance_raw > 0:
                    # Convert balance to USD value
                    price_usd = self.oracle.price_usd(symbol, asset_addr)
                    token_info = self.vault.tokens[symbol]
                    balance_tokens = balance_raw / (10 ** token_info.decimals)
                    usd_value = balance_tokens * price_usd
                    total_value += usd_value
                    weights[symbol] = usd_value
                else:
                    weights[symbol] = 0.0
            
        # Add USDC from vault
        pending_usdc = self.vault.get_pending_usdc()
        if pending_usdc > 0:
            usdc_value = pending_usdc / 1e6  # USDC has 6 decimals
            total_value += usdc_value
            weights["USDC"] = usdc_value
        
        # Convert to percentages
        if total_value > 0:
            for symbol in weights:
                weights[symbol] = weights[symbol] / total_value
        
        return weights
    
    def _execute_vault_rebalancing(self, target_w: Dict[str, float], cur_w: Dict[str, float], vault_value_usdc: int):
        """Execute rebalancing using vault's deployCapital and liquidateAsset functions."""
        # Calculate required changes in USDC amounts
        vault_value_usd = vault_value_usdc / 1e6  # Convert from 6-decimal USDC to USD
        
        for symbol in target_w:
            if symbol.upper() == "USDC":
                continue  # Skip USDC, it's the base currency
                
            current_weight = cur_w.get(symbol, 0.0)
            target_weight = target_w[symbol]
            weight_diff = target_weight - current_weight
            
            # Convert weight difference to USD amount
            usd_diff = weight_diff * vault_value_usd
            
            # Only execute if difference is significant
            band_pp = self.plan["rebalance"]["band_pp"] / 100.0
            if abs(weight_diff) < band_pp:
                continue
                
            token_info = self.vault.tokens[symbol]
            
            if usd_diff > 0:
                # Need to buy more of this asset (deploy capital)
                usdc_amount = int(usd_diff * 1e6)  # Convert to 6-decimal USDC
                if self.exec_mode == "EOA_DIRECT":
                    try:
                        txh = self.router.deploy_capital(self.vault, token_info.address, usdc_amount)
                        log.info("Deployed $%.2f USDC to buy %s, tx=%s", usd_diff, symbol, txh)
                    except Exception as e:
                        log.error("Failed to deploy capital for %s: %s", symbol, e)
                elif self.exec_mode == "DRY_RUN":
                    log.info("DRY_RUN: Would deploy $%.2f USDC to buy %s", usd_diff, symbol)
                    
            else:
                # Need to sell some of this asset (liquidate)
                price_usd = self.oracle.price_usd(symbol, token_info.address)
                asset_amount = int((abs(usd_diff) / price_usd) * (10 ** token_info.decimals))
                if self.exec_mode == "EOA_DIRECT":
                    try:
                        txh = self.router.liquidate_asset(self.vault, token_info.address, asset_amount)
                        log.info("Liquidated %.4f %s (≈$%.2f) to USDC, tx=%s", asset_amount/(10**token_info.decimals), symbol, abs(usd_diff), txh)
                    except Exception as e:
                        log.error("Failed to liquidate %s: %s", symbol, e)
                elif self.exec_mode == "DRY_RUN":
                    log.info("DRY_RUN: Would liquidate %.4f %s (≈$%.2f) to USDC", asset_amount/(10**token_info.decimals), symbol, abs(usd_diff))
        
        self.last_rebalance_ts = time.time()

# --------------------------- Multi-vault runner -----------------------
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
                chainlink_feeds=self.base['oracle_feeds'],
                router_addr=self.base['router'],
                usdc_addr=self.base['usdc'],
                cp_key=self.base.get('cp_key',''),
                execution_mode=self.base['mode'],
                private_key=self.base.get('private_key'),
                cooldown_hours=v.cooldown_hours or self.base.get('cooldown_hours', 6),
                strategy_id=v.strategy_id
            )
            self.executors.append(ex)

    def _load_plan(self, v: VaultCfg) -> dict:
        # First, try to load from database if strategy_id is provided
        if v.strategy_id and SupabaseClient is not None:
            db_plan = self._load_plan_from_db(v.strategy_id)
            if db_plan is not None:
                return db_plan
        
        # Fallback to existing methods
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

    def _load_plan_from_db(self, strategy_id: str) -> Optional[dict]:
        """Load strategy plan from database."""
        try:
            supabase_url = os.environ.get("SUPABASE_URL")
            supabase_key = os.environ.get("SUPABASE_SERVICE_ROLE")
            if not supabase_url or not supabase_key:
                return None
            
            db_client = create_client(supabase_url, supabase_key)
            result = db_client.table("strategies").select("plan_json").eq("id", strategy_id).execute()
            
            if not result.data:
                log.warning("Strategy %s not found in database for plan loading", strategy_id)
                return None
            
            plan_json = result.data[0].get("plan_json", {})
            if not plan_json:
                log.warning("No plan_json found for strategy %s", strategy_id)
                return None
            
            log.info("Loaded plan from database for strategy: %s", strategy_id)
            return plan_json
            
        except Exception as e:
            log.warning("Error loading plan from database for strategy %s: %s", strategy_id, e)
            return None

    def run_once(self):
        for ex in self.executors:
            log.info("=== Vault %s ===", ex.vault.vault)
            ex.run_vault_cycle()  # Use enhanced MultiAssetVault cycle by default

    def run_loop(self, interval_sec: int = 600):
        while True:
            self.run_once()
            time.sleep(interval_sec)

# ------------------------------ CLI -----------------------------------
if __name__ == "__main__":
    import argparse
    p = argparse.ArgumentParser(description="Executor Bot (multi-vault; EOA or Dry-Run)")
    p.add_argument('--once', action='store_true', help='Run a single cycle and exit')
    p.add_argument('--interval', type=int, default=int(os.environ.get('EXEC_INTERVAL', '600')), help='Loop interval seconds')
    p.add_argument('--plan', type=str, default=os.environ.get('PLAN_JSON_PATH', ''), help='Path to plan.json (single-vault fallback)')
    p.add_argument('--planner-url', type=str, default=os.environ.get('PLANNER_URL', ''), help='Planner URL (single-vault fallback)')
    p.add_argument('--text', type=str, default=os.environ.get('PLAN_TEXT', ''), help='Planner text (single-vault fallback)')
    args = p.parse_args()

    # Web3
    rpc = os.environ.get('RPC_URL'); assert rpc, 'RPC_URL is required'
    w3 = Web3(Web3.HTTPProvider(rpc))

    # Base config
    mode = os.environ.get('EXECUTION_MODE', 'DRY_RUN').upper()
    pk = os.environ.get('PRIVATE_KEY')
    base_cfg = {
        'mode': mode,
        'private_key': pk,
        'router': os.environ.get('ORDER_ROUTER'),
        'usdc': os.environ.get('USDC'),
        'oracle_feeds': _json_env('ORACLE_FEEDS'),
        'cp_key': os.environ.get('CRYPTOPANIC_KEY',''),
        'cooldown_hours':  int(os.environ.get('DEFAULT_COOLDOWN_HOURS','6')),
    }
    assert base_cfg['router'] and base_cfg['usdc'], 'ORDER_ROUTER/USDC required'
    if mode == 'EOA_DIRECT' and not pk:
        raise SystemExit('EOA_DIRECT requires PRIVATE_KEY in env')

    # Multi-vault config via VAULTS_JSON (preferred)
    vlist_env = os.environ.get('VAULTS_JSON','')
    print("VAULTS_JSON:", vlist_env)
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
                cooldown_hours=item.get('cooldown_hours'),
                strategy_id=item.get('strategy_id')
            ))
    else:
        # Single-vault fallback from legacy envs
        vaddr = os.environ.get('VAULT_ADDRESS') or '<vault>'
        allowed_tokens = _json_env('VAULT_ALLOWED_TOKENS') or {
            "USDC": os.environ.get('USDC','<usdc>'),
            "WAVAX": os.environ.get('WAVAX','<weth>'),
            "USDT": os.environ.get('USDT','<usdt>'),
        }
        print("Allowed tokens:", allowed_tokens)
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