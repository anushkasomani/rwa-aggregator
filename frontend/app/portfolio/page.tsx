"use client";
import React, { useEffect, useMemo, useState } from "react";
import { useAppState } from "@/components/state/AppStateProvider";
import { useWallet } from "@/components/wallet/WalletProvider";
import { ethers } from "ethers";
import VaultArtifact from "../../abi/MultiAssetVault.json";

/* ---------------- Types ---------------- */

type CreatedRow = {
  id: string;
  name: string;
  aum?: number | null;
  holders?: number | null;
  m30?: number | null;
  since?: string | null;
  status?: string | null;
};

type InvestedRow = {
  id: string;               // strategy id
  name: string;
  shares?: number | null;
  value?: number | null;
  pnl?: number | null;
  since?: string | null;    // investment.created_at
  last?: string | null;     // last activity
};

type StrategyDetail = {
  id: string;
  name: string;
  created_at?: string;
  status?: string;
  vault_address?: string | null;  // needed for redeem
};

type InvestmentAPI = {
  id: string;
  strategy_id: string;
  investor_address: string;
  amount?: number | null;
  tx_hash?: string | null;
  created_at: string;
  strategy?: StrategyDetail | null;
};

type InvestmentsByUserAPI = { items?: InvestmentAPI[] } | InvestmentAPI[];
type StrategiesByUserAPI = { items?: any[] } | any[];

/* ---------------- API endpoints ---------------- */

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8080";
const GET_STRATS_BY_USER = (addr: string) =>
  `${API_BASE}/v1/strategies/by-user/${addr}?limit=50`;
const GET_INVESTMENTS_BY_USER = (addr: string) =>
  `${API_BASE}/v1/investments/by-user/${addr}?limit=50`;
const GET_STRATEGY = (id: string) => `${API_BASE}/v1/strategies/${id}`;

/* ---------------- ABIs ---------------- */

const VAULT_ABI = (VaultArtifact as any).abi;

/* ---------------- Helpers ---------------- */

function fmtNum(n?: number | null) {
  if (n == null || !isFinite(Number(n))) return "—";
  return Number(n).toLocaleString();
}
function fmtMoney(n?: number | null) {
  if (n == null || !isFinite(Number(n))) return "—";
  return `$${Number(n).toLocaleString()}`;
}
function fmtPct(n?: number | null) {
  if (n == null || !isFinite(Number(n))) return "—";
  const v = Math.abs(Number(n)) <= 1 ? Number(n) * 100 : Number(n);
  return `${v.toFixed(2)}%`;
}
function fmtDate(s?: string | null) {
  if (!s) return "—";
  try {
    const d = new Date(s);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });
  } catch {
    return "—";
  }
}
function toNum(x: any): number | null {
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

function formatError(err: any): string {
  if (!err) return "Unknown error";
  return err.reason ?? err.shortMessage ?? err.message ?? (typeof err === "string" ? err : JSON.stringify(err));
}

async function getSignerAndOwner() {
  if (typeof window !== "undefined" && (window as any).ethereum) {
    const provider = new ethers.BrowserProvider((window as any).ethereum);
    const signer = await provider.getSigner();
    const owner = ethers.getAddress(await signer.getAddress());
    return { provider, signer, owner };
  }
  throw new Error("MetaMask is not available in this browser.");
}

const safeAddr = (label: string, v?: string | null) => {
  if (!v || typeof v !== "string" || !v.startsWith("0x") || v.length !== 42) {
    throw new Error(`${label} must be a 42-char 0x address. Got: ${v}`);
  }
  return ethers.getAddress(v.toLowerCase());
};

/* ---------------- Page ---------------- */

export default function PortfolioPage() {
  const { state, setState, setToast } = useAppState();
  const { setModalOpen } = useWallet(); // CHANGED: stop reading useWallet().address; we’ll derive from signer only

  const [tab, setTab] = useState<"Invested" | "Created">("Invested");
  const [loading, setLoading] = useState(false);

  // Single source of truth EOA (from signer)
  const [ownerAddr, setOwnerAddr] = useState<string>(""); // CHANGED: holds signer.getAddress()

  // Redeem modal state
  const [redeemOpen, setRedeemOpen] = useState(false);
  const [redeeming, setRedeeming] = useState(false);
  const [redeemRow, setRedeemRow] = useState<InvestedRow | null>(null);
  const [redeemVault, setRedeemVault] = useState<string | null>(null);
  const [userShares, setUserShares] = useState<bigint>(0n);
  const [shareDec, setShareDec] = useState<number>(18);
  const [lastNav, setLastNav] = useState<bigint>(0n);     // 1e18 scaled
  const [maxUsdc6, setMaxUsdc6] = useState<bigint>(0n);   // userShares * nav -> USDC(6)

  /* ---------- Resolve signer address once connected ---------- */
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { owner } = await getSignerAndOwner();
        if (!alive) return;
        setOwnerAddr(owner);
      } catch {
        // not connected yet
      }
    })();
    return () => { alive = false; };
  }, []);

  /* ---------- LOAD DATA (uses signer address only) ---------- */
  useEffect(() => {
    (async () => {
      if (!ownerAddr) return; // CHANGED: gate on signer address
      const alreadyLoaded =
        (state.portfolio?.invested?.length ?? 0) > 0 ||
        (state.portfolio?.created?.length ?? 0) > 0;

      // Optional: if owner switches, you might want to clear and reload
      // For now, always load when ownerAddr first appears.
      if (alreadyLoaded) return;

      setLoading(true);
      try {
        const [createdRows, investedRows] = await Promise.all([
          fetchCreated(ownerAddr),  // CHANGED
          fetchInvested(ownerAddr), // CHANGED
        ]);

        setState((s: any) => ({
          ...s,
          portfolio: {
            created: createdRows,
            invested: investedRows,
          },
        }));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerAddr]); // CHANGED

  const createdList: CreatedRow[] = useMemo(
    () => (state.portfolio?.created as CreatedRow[]) ?? [],
    [state.portfolio?.created]
  );
  const investedList: InvestedRow[] = useMemo(
    () => (state.portfolio?.invested as InvestedRow[]) ?? [],
    [state.portfolio?.invested]
  );

  /* ---------- Redeem open ---------- */
  async function openRedeem(row: InvestedRow) {
    try {
      // If no signer yet, ask to connect
      if (!ownerAddr) return setModalOpen(true); // CHANGED: gate on signer address
      setRedeemRow(row);

      // get signer/owner
      const { signer, owner } = await getSignerAndOwner(); // CHANGED
      setOwnerAddr(owner); // keep state in sync in case it just connected

      // fetch strategy to get vault address
      const res = await fetch(GET_STRATEGY(row.id));
      if (!res.ok) throw new Error(`GET /strategy ${row.id} failed (${res.status})`);
      const detail = (await res.json()) as StrategyDetail;
      const VAULT_ADDR = safeAddr("vault", detail.vault_address);
      setRedeemVault(VAULT_ADDR);

      // read shares + nav
      const vault = new ethers.Contract(VAULT_ADDR, VAULT_ABI, signer);
      const [dec, nav]: [number, bigint] = await Promise.all([
        vault.decimals().catch(() => 18),
        vault.lastNavPerShare().catch(() => 0n),
      ]);
      const bal: bigint = await vault.balanceOf(owner); // CHANGED: use local owner from signer

      // compute estimated max USDC(6): shares * nav / 1e18 / 1e12
      const max6 = nav > 0n ? (bal * nav) / 10n ** 18n / 10n ** 12n : 0n;

      setShareDec(dec);
      setLastNav(nav);
      setUserShares(bal);
      setMaxUsdc6(max6);

      setRedeemOpen(true);
    } catch (e) {
      setToast({ title: "Redeem init failed", description: formatError(e), tone: "error" });
      setRedeemOpen(false);
    }
  }

  /* ---------- Redeem confirm ---------- */
  async function confirmRedeem(usdcAmountStr: string) {
    if (!redeemRow || !redeemVault) return;
    try {
      setRedeeming(true);
      const { signer } = await getSignerAndOwner();
      const VAULT_ADDR = ethers.getAddress(redeemVault);
      const vault = new ethers.Contract(VAULT_ADDR, VAULT_ABI, signer);

      // Parse input
      const trimmed = (usdcAmountStr || "").trim();
      if (!trimmed) throw new Error("Enter an amount");
      if (lastNav === 0n) throw new Error("NAV is not available right now");

      // Convert USDC(6) -> shares: shares = usdc6 * 1e12 * 1e18 / nav
      const wanted6 = ethers.parseUnits(trimmed, 6);
      const sharesNeeded = 0.1;

      // Min shares (try reading from contract; fallback to 1e15 = 0.001)
      let minShares = 10n ** 15n;
      try {
        const ms = await vault.minRedemptionShares();
        if (typeof ms === "bigint" && ms > 0n) minShares = ms;
      } catch {}

      // if (sharesNeeded < minShares) {
      //   const minHuman = Number(ethers.formatUnits(minShares, shareDec)).toFixed(6);
      //   throw new Error(`Minimum redemption is ${minHuman} shares`);
      // }

      // if (userShares < sharesNeeded) {
      //   const have = Number(ethers.formatUnits(userShares, shareDec)).toFixed(6);
      //   const need = Number(ethers.formatUnits(sharesNeeded, shareDec)).toFixed(6);
      //   throw new Error(`Not enough shares. You have ${have}, need ${need}.`);
      // }

      // Queue the redemption
      const tx = await vault.requestRedemption(userShares);
      await tx.wait();

      setToast({
        title: "Redemption queued",
        description: `Your request has been queued.`,
        tone: "success",
      });

      setRedeemOpen(false);
    } catch (e) {
      console.log(e);
      setToast({ title: "Redeem failed", description: formatError(e), tone: "error" });
    } finally {
      setRedeeming(false);
    }
  }

  /* ---------- Render ---------- */
  const connected = !!ownerAddr; // CHANGED: UI gate

  return (
    <main className="mx-auto w-[min(1100px,94%)] py-12">
      <h1 className="heading text-3xl mb-4">My Portfolio</h1>

      {!connected ? (
        <div className="card glass-panel p-6 text-center">
          Connect your wallet to view your portfolio.&nbsp;
          <button className="btn-secondary inline-block" onClick={() => setModalOpen(true)}>
            Connect
          </button>
        </div>
      ) : (
        <>
          <div className="flex gap-2 mb-3">
            {(["Invested", "Created"] as const).map((t) => (
              <button
                key={t}
                className={`btn-secondary ${
                  tab === t
                    ? "shadow-[0_0_18px_rgba(0,229,255,.25)] border-[color-mix(in_srgb,var(--accent)_60%,transparent)]"
                    : ""
                }`}
                onClick={() => setTab(t)}
              >
                {t}
              </button>
            ))}
          </div>

          {tab === "Invested" ? (
            (investedList?.length ?? 0) ? (
              <div className="card glass-panel p-4">
                <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_1fr] gap-2 text-sm text-subtle">
                  <div>Strategy</div>
                  <div>Shares</div>
                  <div>Value</div>
                  <div>P&amp;L %</div>
                  <div>Since</div>
                  <div>Last</div>
                  <div>Actions</div>
                </div>
                <div className="mt-2 grid gap-2">
                  {investedList.map((r) => (
                    <div
                      key={r.id}
                      className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_1fr] gap-2 items-center rounded-xl border p-3 border-[color-mix(in_srgb,var(--foreground)_10%,transparent)]"
                    >
                      <a href={`/strategy/${r.id}`} className="neon-underline">
                        {r.name}
                      </a>
                      <div>{fmtNum(r.shares)}</div>
                      <div>{fmtMoney(r.value)}</div>
                      <div>{fmtPct(r.pnl)}</div>
                      <div>{fmtDate(r.since)}</div>
                      <div>{fmtDate(r.last)}</div>
                      <div className="flex gap-2">
                        <button
                          className="btn-secondary"
                          onClick={() => openRedeem(r)}
                        >
                          Redeem
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="card glass-panel p-6 text-center">
                {loading ? "Loading…" : <>No investments yet. <a className="neon-underline" href="/explore">Explore</a> or <a className="neon-underline" href="/build">Build</a>.</>}
              </div>
            )
          ) : (createdList?.length ?? 0) ? (
            <div className="card glass-panel p-4">
              <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr] gap-2 text-sm text-subtle">
                <div>Strategy</div>
                <div>AUM</div>
                <div>Holders</div>
                <div>30D</div>
                <div>Since</div>
                <div>Status</div>
              </div>
              <div className="mt-2 grid gap-2">
                {createdList.map((r) => (
                  <div
                    key={r.id}
                    className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr] gap-2 items-center rounded-xl border p-3 border-[color-mix(in_srgb,var(--foreground)_10%,transparent)]"
                  >
                    <a href={`/strategy/${r.id}`} className="neon-underline">
                      {r.name}
                    </a>
                    <div>{fmtMoney(r.aum)}</div>
                    <div>{fmtNum(r.holders)}</div>
                    <div>{fmtPct(r.m30)}</div>
                    <div>{fmtDate(r.since)}</div>
                    <div>{r.status ?? "active"}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="card glass-panel p-6 text-center">
              {loading ? "Loading…" : <>No created strategies yet. <a className="neon-underline" href="/build">Create one</a>.</>}
            </div>
          )}
        </>
      )}

      {/* Redeem modal */}
      <RedeemModal
        open={redeemOpen}
        onClose={() => setRedeemOpen(false)}
        onConfirm={(amt) => confirmRedeem(amt)}
        confirming={redeeming}
        maxUsdc6={maxUsdc6}
        ownerShares={userShares}
        shareDec={shareDec}
      />
    </main>
  );
}

/* ---------------- Data loaders ---------------- */

async function fetchCreated(address: string): Promise<CreatedRow[]> {
  try {
    const res = await fetch(GET_STRATS_BY_USER(address));
    if (!res.ok) throw new Error(`GET by-user failed: ${res.status}`);
    const json: StrategiesByUserAPI = await res.json();
    const items = Array.isArray(json) ? json : json.items || [];
    return (items as any[]).map((it) => {
      const id = String(it.id);
      const name = String(it.name ?? "Unnamed Strategy");
      const aum = toNum(it.aum);
      const holders = toNum(it.holders);
      const m30 = toNum(it.m30);
      const since = String(it.created_at || "");
      const status = String(it.status || "active");
      return { id, name, aum, holders, m30, since, status };
    });
  } catch (e) {
    console.error(e);
    return [];
  }
}

async function fetchInvested(address: string): Promise<InvestedRow[]> {
  try {
    const res = await fetch(GET_INVESTMENTS_BY_USER(address));
    if (!res.ok) {
      console.warn("Investments endpoint not ready:", res.status);
      return [];
    }
    const json: InvestmentsByUserAPI = await res.json();
    const items: InvestmentAPI[] = Array.isArray(json) ? json : json.items || [];

    const needLookup = items.filter((r) => !r.strategy);
    const lookups = await Promise.allSettled(
      needLookup.map((r) => fetch(GET_STRATEGY(r.strategy_id)).then((x) => x.json()))
    );
    const byId = new Map<string, StrategyDetail>();
    lookups.forEach((p, i) => {
      if (p.status === "fulfilled") {
        const detail = p.value as StrategyDetail;
        const id = needLookup[i].strategy_id;
        byId.set(id, detail);
      }
    });

    return items.map((r) => {
      const strat = r.strategy || byId.get(r.strategy_id);
      const name = String(strat?.name ?? "Strategy");
      const shares = null; // on-chain lookup later if needed
      const value = toNum(r.amount);
      const pnl = null;
      const since = r.created_at || strat?.created_at || null;
      const last = null;
      return { id: r.strategy_id, name, shares, value, pnl, since, last };
    });
  } catch (e) {
    console.error(e);
    return [];
  }
}

/* ---------------- RedeemModal ---------------- */

function RedeemModal({
  open,
  onClose,
  onConfirm,
  confirming,
  maxUsdc6,
  ownerShares,
  shareDec,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (amountStr: string) => void;
  confirming: boolean;
  maxUsdc6: bigint;
  ownerShares: bigint;
  shareDec: number;
}) {
  const [amount, setAmount] = useState("");

  useEffect(() => {
    if (!open) setAmount("");
  }, [open]);

  if (!open) return null;

  const maxUsdcHuman = Number(ethers.formatUnits(maxUsdc6, 6) || "0").toFixed(2);
  const sharesHuman = Number(ethers.formatUnits(ownerShares || 0n, shareDec)).toFixed(6);

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(520px,94%)] card glass-panel p-6">
        <h3 className="heading text-xl">Redeem</h3>
        <div className="mt-3 text-sm text-subtle grid gap-1">
          <div>Your shares: {sharesHuman}</div>
          <div>Est. max USDC: ${maxUsdcHuman}</div>
        </div>
        <div className="mt-4 grid gap-2">
          <label className="text-sm text-subtle">Amount (USDC)</label>
          <div className="flex gap-2">
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="e.g. 50"
              className="bg-transparent rounded-xl border border-[color-mix(in_srgb,var(--foreground)_10%,transparent)] p-3 outline-none flex-1"
              inputMode="decimal"
            />
            <button
              className="btn-secondary"
              onClick={() => setAmount(maxUsdcHuman)}
            >
              Max
            </button>
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <button
            className="btn-primary"
            onClick={() => onConfirm(amount)}
            disabled={confirming || !amount}
          >
            {confirming ? "Submitting…" : "Confirm"}
          </button>
          <button className="btn-secondary" onClick={onClose} disabled={confirming}>
            Cancel
          </button>
        </div>
        <div className="text-subtle text-xs mt-2">
          Redemption requests are queued and processed as liquidity is available.
        </div>
      </div>
    </div>
  );
}
