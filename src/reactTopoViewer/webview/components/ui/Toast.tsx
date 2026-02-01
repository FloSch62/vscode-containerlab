/**
 * Toast Component - MUI Snackbar/Alert notifications.
 */
import React, { useCallback, useState } from "react";
import { Alert, Snackbar } from "@mui/material";

export interface ToastMessage {
  id: string;
  message: string;
  type?: "info" | "success" | "warning" | "error";
  duration?: number;
}

interface ToastProps {
  toast: ToastMessage;
  onDismiss: (id: string) => void;
  offset: number;
}

const Toast: React.FC<ToastProps> = ({ toast, onDismiss, offset }) => (
  <Snackbar
    open
    autoHideDuration={toast.duration ?? 3000}
    onClose={(_, reason) => {
      if (reason === "clickaway") return;
      onDismiss(toast.id);
    }}
    anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
    sx={{ mb: offset }}
  >
    <Alert
      severity={toast.type ?? "info"}
      variant="filled"
      onClose={() => onDismiss(toast.id)}
    >
      {toast.message}
    </Alert>
  </Snackbar>
);

interface ToastContainerProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <>
      {toasts.map((toast, index) => (
        <Toast key={toast.id} toast={toast} onDismiss={onDismiss} offset={index * 7} />
      ))}
    </>
  );
};

// Counter for generating unique toast IDs
let toastIdCounter = 0;

/**
 * Hook for managing toast notifications
 */
export function useToasts() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback(
    (message: string, type: ToastMessage["type"] = "info", duration?: number) => {
      const id = `toast-${Date.now()}-${++toastIdCounter}`;
      setToasts((prev) => [...prev, { id, message, type, duration }]);
      return id;
    },
    []
  );

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return {
    toasts,
    addToast,
    dismissToast
  };
}
