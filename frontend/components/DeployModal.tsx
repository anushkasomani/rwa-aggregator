"use client";
import React from "react";

type DeployModalProps = {
  open: boolean;
  onClose: () => void;
  /** Called with the validated amount (string, e.g. "12.34") */
  onConfirm: (amount: string) => void;
  /** Called when user clicks confirm with no/invalid amount (use to show toast) */
  onInvalidConfirm?: (reason: string) => void;
  /** Show loading state on the confirm button */
  confirming?: boolean;
  /** Minimum USDC required in UI (defaults to 10) */
  minUsdc?: number;
  /** Prefill the input (optional) */
  defaultAmount?: string;
};

export default function DeployModal({
  open,
  onClose,
  onConfirm,
  onInvalidConfirm,
  confirming = false,
  minUsdc = 1,
  defaultAmount = "",
}: DeployModalProps) {
  const [amount, setAmount] = React.useState<string>(defaultAmount);

  React.useEffect(() => {
    if (open) setAmount(defaultAmount);
  }, [open, defaultAmount]);

  if (!open) return null;

  const checks = [
    "Fee caps set",
    "Drift bands ±5pp",
    "Turnover ≤ 15%",
    "Order max $2k",
    "Slippage ≤ 80 bps",
    "48h timelock",
    "Guardian pause",
  ];

  const num = Number(amount);
  const hasInput = amount.trim().length > 0;
  const meetsMin = Number.isFinite(num) && num >= minUsdc;
  const valid = hasInput && meetsMin;

  const invalidReason = !hasInput
    ? "Enter an amount to proceed"
    : `Minimum deposit is ${minUsdc} USDC`;

  const handleConfirm = () => {
    // Looks disabled when invalid, but still clickable to surface a toast.
    if (!valid || confirming) {
      onInvalidConfirm?.(invalidReason);
      return;
    }
    onConfirm(amount.trim());
  };

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(560px,94%)] card glass-panel p-6">
        <h3 className="heading text-xl">Confirm & Deploy</h3>

        <ul className="mt-3 grid gap-2 text-sm">
          {checks.map((c) => (
            <li key={c} className="flex items-center gap-2">
              <span className="text-[var(--accent)]">✅</span> {c}
            </li>
          ))}
        </ul>

        <div className="mt-3 text-subtle text-sm grid gap-1">
          <div>Owner: Safe (multisig)</div>
          <div>Roles policy hash: 0x7f...ab</div>
          <div>Receipts (ERC-1155) enabled</div>
        </div>

        {/* Deposit amount */}
        <div className="mt-4 grid gap-2">
          <label htmlFor="deploy-deposit" className="block text-sm">
            Deposit Amount (USDC)
          </label>
          <input
            id="deploy-deposit"
            type="number"
            inputMode="decimal"
            min={minUsdc}
            step="0.01"
            placeholder={`Enter amount (min ${minUsdc} USDC)`}
            className="w-full rounded-lg border p-2 text-sm bg-transparent"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleConfirm();
            }}
            autoFocus
            required
          />
          {!valid && hasInput && (
            <div className="text-xs text-red-400">
              Minimum deposit is {minUsdc} USDC.
            </div>
          )}
          <div className="text-xs text-subtle">
            We will deploy the vault, then approve and deposit this amount into it.
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <button
            className={`btn-primary ${(!valid || confirming) ? "opacity-60 cursor-not-allowed" : ""}`}
            aria-disabled={!valid || confirming}
            onClick={handleConfirm}
            title={!valid ? invalidReason : ""}
          >
            {confirming ? "Deploying…" : "Confirm & Deploy"}
          </button>
          <button className="btn-secondary" onClick={onClose} disabled={confirming}>
            Cancel
          </button>
        </div>

        <div className="text-subtle text-xs mt-2">
          Deployment is non-custodial and subject to policy constraints.
        </div>
      </div>
    </div>
  );
}
