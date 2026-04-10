"use client";

import { Search, X } from "lucide-react";
import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from "react";

type ToastType = "success" | "error" | "info";

type Toast = {
  id: number;
  type: ToastType;
  title: string;
  message?: string;
};

type ToastInput = Omit<Toast, "id">;

type AdminFeedbackContextValue = {
  notify: (toast: ToastInput) => void;
};

const AdminFeedbackContext = createContext<AdminFeedbackContextValue>({
  notify: () => {},
});

export function AdminFeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const notify = useCallback(
    (toast: ToastInput) => {
      const id = Date.now() + Math.random();
      setToasts((current) => [...current.slice(-2), { ...toast, id }]);
      window.setTimeout(() => dismiss(id), toast.type === "error" ? 7000 : 4200);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ notify }), [notify]);

  return (
    <AdminFeedbackContext.Provider value={value}>
      {children}
      <div className="fixed right-4 top-4 z-[80] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-3">
        {toasts.map((toast) => {
          const tone =
            toast.type === "error"
              ? "border-rose-200 bg-rose-50 text-rose-900"
              : toast.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                : "border-sky-200 bg-sky-50 text-sky-900";

          return (
            <div key={toast.id} className={`rounded-2xl border px-4 py-3 shadow-lg backdrop-blur ${tone}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">{toast.title}</p>
                  {toast.message ? <p className="mt-1 text-xs opacity-80">{toast.message}</p> : null}
                </div>
                <button
                  type="button"
                  onClick={() => dismiss(toast.id)}
                  className="rounded-lg p-1 opacity-70 transition hover:bg-black/5 hover:opacity-100"
                  aria-label="Dismiss notification"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </AdminFeedbackContext.Provider>
  );
}

export function useAdminToast() {
  return useContext(AdminFeedbackContext);
}

export function AdminSearchInput({
  value,
  onChange,
  placeholder,
  className = "",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  className?: string;
}) {
  return (
    <label className={`relative block ${className}`}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
      />
    </label>
  );
}

export function AdminLoadingState({ label = "Loading data..." }: { label?: string }) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-500">{label}</p>
      {[0, 1, 2].map((item) => (
        <div key={item} className="h-16 animate-pulse rounded-xl border border-slate-200 bg-slate-100" />
      ))}
    </div>
  );
}

export function AdminEmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
      <p className="text-sm font-semibold text-slate-800">{title}</p>
      {description ? <p className="mx-auto mt-1 max-w-md text-xs text-slate-500">{description}</p> : null}
    </div>
  );
}
