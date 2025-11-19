import { useState, useCallback } from 'react';

export type ToastType = 'error' | 'success';

interface ToastState {
  isVisible: boolean;
  message: string;
  type: ToastType;
}

interface UseToastReturn {
  toastState: ToastState;
  showToast: (message: string, type?: ToastType) => void;
  showError: (message: string) => void;
  showSuccess: (message: string) => void;
  dismissToast: () => void;
}

/**
 * useToast - Custom hook for managing toast notifications
 *
 * Usage:
 * ```tsx
 * const { toastState, showError, showSuccess, dismissToast } = useToast();
 *
 * showError('Something went wrong');
 * showSuccess('Operation completed');
 * ```
 */
export const useToast = (): UseToastReturn => {
  const [toastState, setToastState] = useState<ToastState>({
    isVisible: false,
    message: '',
    type: 'error',
  });

  const showToast = useCallback((message: string, type: ToastType = 'error') => {
    setToastState({
      isVisible: true,
      message,
      type,
    });
  }, []);

  // Reuse showToast for consistency and maintainability
  const showError = useCallback((message: string) => {
    showToast(message, 'error');
  }, [showToast]);

  const showSuccess = useCallback((message: string) => {
    showToast(message, 'success');
  }, [showToast]);

  const dismissToast = useCallback(() => {
    setToastState((prev) => ({
      ...prev,
      isVisible: false,
      message: '',
    }));
  }, []);

  return {
    toastState,
    showToast,
    showError,
    showSuccess,
    dismissToast,
  };
};
