import { createContext, ReactNode, useCallback, useContext, useMemo, useState } from "react";

type AlertOptions = {
  title?: string;
  confirmLabel?: string;
};

type ConfirmOptions = AlertOptions & {
  cancelLabel?: string;
};

type AlertDialog = {
  type: "alert";
  title?: string;
  message: string;
  confirmLabel: string;
  resolve: () => void;
};

type ConfirmDialog = {
  type: "confirm";
  title?: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  resolve: (result: boolean) => void;
};

type DialogState = AlertDialog | ConfirmDialog;

interface DialogContextValue {
  alert: (message: string, options?: AlertOptions) => Promise<void>;
  confirm: (message: string, options?: ConfirmOptions) => Promise<boolean>;
}

const DialogContext = createContext<DialogContextValue | undefined>(undefined);

export function DialogProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<DialogState[]>([]);
  const activeDialog = queue[0];

  const alert = useCallback((message: string, options?: AlertOptions) => {
    return new Promise<void>(resolve => {
      setQueue(prev => [
        ...prev,
        {
          type: "alert",
          message,
          title: options?.title,
          confirmLabel: options?.confirmLabel ?? "Aceptar",
          resolve,
        },
      ]);
    });
  }, []);

  const confirm = useCallback((message: string, options?: ConfirmOptions) => {
    return new Promise<boolean>(resolve => {
      setQueue(prev => [
        ...prev,
        {
          type: "confirm",
          message,
          title: options?.title,
          confirmLabel: options?.confirmLabel ?? "Confirmar",
          cancelLabel: options?.cancelLabel ?? "Cancelar",
          resolve,
        },
      ]);
    });
  }, []);

  const handleResolve = useCallback(
    (value: boolean) => {
      if (!activeDialog) return;
      setQueue(prev => prev.slice(1));
      if (activeDialog.type === "alert") {
        activeDialog.resolve();
      } else {
        activeDialog.resolve(value);
      }
    },
    [activeDialog],
  );

  const contextValue = useMemo<DialogContextValue>(
    () => ({
      alert,
      confirm,
    }),
    [alert, confirm],
  );

  return (
    <DialogContext.Provider value={contextValue}>
      {children}
      {activeDialog ? (
        <div className="dialog-overlay" role="dialog" aria-modal="true">
          <div className="dialog-card">
            {activeDialog.title ? <h3>{activeDialog.title}</h3> : null}
            <p>{activeDialog.message}</p>
            <div className="dialog-buttons">
              {activeDialog.type === "confirm" ? (
                <button
                  type="button"
                  className="dialog-button secondary"
                  onClick={() => handleResolve(false)}
                >
                  {activeDialog.cancelLabel}
                </button>
              ) : null}
              <button
                type="button"
                className="dialog-button primary"
                onClick={() => handleResolve(true)}
              >
                {activeDialog.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </DialogContext.Provider>
  );
}

export function useDialog(): DialogContextValue {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error("useDialog must be used within a DialogProvider");
  }
  return context;
}
