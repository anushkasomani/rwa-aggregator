"use client";
import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import { useToast } from "@/components/toast/ToastProvider";

export type AppState = {
  plan: any | null;
  backtest: { stats: any; equity_curve: any[] } | null;
  explain: any | null;
  review: any | null;
  wallet: { connected: boolean; address: string };
  explore: { list: any[]; filters: Record<string, any> };
  detail: any | null;
  portfolio: { invested: any[]; created: any[] };
  loading: Record<string, boolean>;
  toast: { title: string; description?: string; tone?: "info"|"success"|"warning"|"error" } | null;
};

type Ctx = {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  setToast: (t: AppState["toast"]) => void;
};

const defaultState: AppState = {
  plan: null,
  backtest: null,
  explain: null,
  review: null,
  wallet: { connected: false, address: "" },
  explore: { list: [], filters: {} },
  detail: null,
  portfolio: { invested: [], created: [] },
  loading: {},
  toast: null,
};

const StateCtx = createContext<Ctx | null>(null);

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>(defaultState);
  const { push } = useToast();

  const setToast = useCallback((t: AppState["toast"]) => {
    if (!t) return;
    push({ title: t.title, description: t.description, tone: t.tone });
    setState((s) => ({ ...s, toast: t }));
  }, [push]);

  const value = useMemo(() => ({ state, setState, setToast }), [state, setToast]);
  return <StateCtx.Provider value={value}>{children}</StateCtx.Provider>;
}

export function useAppState() {
  const ctx = useContext(StateCtx);
  if (!ctx) throw new Error("useAppState must be used within AppStateProvider");
  return ctx;
}
