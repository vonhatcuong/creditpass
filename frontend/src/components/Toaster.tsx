import React, { createContext, useCallback, useContext, useState } from 'react';

export type ToastKind = 'info' | 'success' | 'error' | 'pending';
export interface ToastItem {
  id: number;
  message: string;
  kind: ToastKind;
}

const Ctx = createContext<{ toasts: ToastItem[]; push(m: string, k?: ToastKind): void; dismiss(id: number): void }>({
  toasts: [],
  push: () => {},
  dismiss: () => {},
});

export const useToasts = () => useContext(Ctx);
let nextId = 1;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const dismiss = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);
  const push = useCallback(
    (message: string, kind: ToastKind = 'info') => {
      const id = nextId++;
      setToasts((t) => [...t, { id, message, kind }]);
      setTimeout(() => dismiss(id), kind === 'error' ? 8000 : 5000);
    },
    [dismiss],
  );
  return <Ctx.Provider value={{ toasts, push, dismiss }}>{children}</Ctx.Provider>;
}

export function Toaster() {
  const { toasts, dismiss } = useToasts();
  return (
    <div className="fixed bottom-5 right-5 z-[100] flex w-[min(380px,90vw)] flex-col gap-2" role="status" aria-live="polite">
      {toasts.map((t) => (
        <button
          key={t.id}
          onClick={() => dismiss(t.id)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') dismiss(t.id);
          }}
          className="rounded-[16px] border border-[#f0f0f0] bg-white p-3 text-left text-sm text-[#141414]"
        >
          {t.message}
        </button>
      ))}
    </div>
  );
}
