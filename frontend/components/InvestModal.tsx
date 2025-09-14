"use client";
import React from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  onConfirm: (amount: string) => void;
  confirming?: boolean;
  minUsdc?: number;
};

export default function InvestModal({
  open,
  onClose,
  onConfirm,
  confirming = false,
  minUsdc = 10,
}: Props) {
  const [amount, setAmount] = React.useState("");

  React.useEffect(() => {
    if (!open) setAmount("");
  }, [open]);

  if (!open) return null;

  const num = Number(amount);
  const hasInput = amount.trim().length > 0;
  const valid = Number.isFinite(num) && num >= minUsdc;

  const handleConfirm = () => {
    if (!valid || confirming) return;
    onConfirm(amount.trim());
  };

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(480px,94%)] card glass-panel p-6">
        <h3 className="heading text-xl">Invest</h3>
        <p className="text-subtle text-sm mt-1">
          Enter your deposit amount in USDC. Funds are queued in the vault and processed per policy.
        </p>

        <div className="mt-4 grid gap-2">
          <label className="block text-sm">Amount (USDC)</label>
          <input
            type="number"
            inputMode="decimal"
            min={minUsdc}
            step="0.01"
            placeholder={`Min ${minUsdc} USDC`}
            className="w-full rounded-lg border p-2 text-sm bg-transparent"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleConfirm()}
            autoFocus
            required
          />
          {!valid && hasInput && (
            <div className="text-xs text-red-400">Minimum is {minUsdc} USDC.</div>
          )}
        </div>

        <div className="mt-4 flex gap-2 justify-end">
          <button className="btn-secondary" onClick={onClose} disabled={confirming}>
            Cancel
          </button>
          <button
            className={`btn-primary ${!valid || confirming ? "opacity-60 cursor-not-allowed" : ""}`}
            onClick={handleConfirm}
            aria-disabled={!valid || confirming}
            title={!valid ? `Enter at least ${minUsdc} USDC` : ""}
          >
            {confirming ? "Depositing…" : "Confirm Deposit"}
          </button>
        </div>
      </div>
    </div>
  );
}
