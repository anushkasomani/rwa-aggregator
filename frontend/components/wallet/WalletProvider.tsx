"use client";
import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

export type WalletCtx = {
  address: string | null;
  connect: (addr?: string) => void;
  disconnect: () => void;
  short: () => string | null;
  modalOpen: boolean;
  setModalOpen: (v: boolean) => void;
};

const Ctx = createContext<WalletCtx | null>(null);

export function WalletProvider({ children }: { children: React.ReactNode }){
  const [address, setAddress] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const connect = useCallback((addr?: string) => {
    const a = addr ?? "0xA3bF1F9cD4729f8a5bE0d3EeA12fF9a4b7F9F9F9";
    setAddress(a);
    setModalOpen(false);
  }, []);
  const disconnect = useCallback(()=> setAddress(null), []);
  const short = useCallback(()=> address ? `${address.slice(0,4)}…${address.slice(-2)}` : null, [address]);

  const value = useMemo(()=> ({ address, connect, disconnect, short, modalOpen, setModalOpen }), [address, connect, disconnect, short, modalOpen]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWallet(){
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useWallet must be used within WalletProvider");
  return ctx;
}
