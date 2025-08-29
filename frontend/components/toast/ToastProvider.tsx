"use client";
import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

type Toast = { id: string; title: string; description?: string; tone?: "info"|"success"|"warning"|"error" };

type Ctx = {
  toasts: Toast[];
  push: (t: Omit<Toast, "id">) => void;
  remove: (id: string) => void;
};

const ToastContext = createContext<Ctx | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const remove = useCallback((id: string) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const push = useCallback((t: Omit<Toast, "id">) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev, { id, ...t }]);
    setTimeout(() => remove(id), 4000);
  }, [remove]);

  const value = useMemo(() => ({ toasts, push, remove }), [toasts, push, remove]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed right-4 bottom-4 z-50 flex flex-col gap-2">
        {toasts.map((t) => (
          <div key={t.id} className={`glass-panel card p-3 min-w-[260px] border ${toneBorder(t.tone)} shadow-lg`}> 
            <div className="flex items-start gap-3">
              <span className={`mt-1 h-2 w-2 rounded-full ${toneDot(t.tone)}`}/>
              <div>
                <div className="font-semibold">{t.title}</div>
                {t.description && <div className="text-subtle text-sm">{t.description}</div>}
              </div>
              <button className="ml-auto text-subtle hover:text-[var(--foreground)]" onClick={() => remove(t.id)} aria-label="Dismiss">×</button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

function toneBorder(t?: Toast["tone"]) {
  switch (t) {
    case "success": return "border-[color-mix(in_srgb,var(--accent)60%,transparent)]";
    case "warning": return "border-[color-mix(in_srgb,#F59E0B_60%,transparent)]";
    case "error": return "border-[color-mix(in_srgb,#EF4444_60%,transparent)]";
    default: return "border-[color-mix(in_srgb,var(--foreground)_10%,transparent)]";
  }
}

function toneDot(t?: Toast["tone"]) {
  switch (t) {
    case "success": return "bg-[var(--accent)]";
    case "warning": return "bg-[#F59E0B]";
    case "error": return "bg-[#EF4444]";
    default: return "bg-[var(--accent-secondary)]";
  }
}
