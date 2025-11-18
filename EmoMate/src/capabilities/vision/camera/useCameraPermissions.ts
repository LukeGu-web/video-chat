/**
 * Camera permissions hook
 * Manages camera permission state and requests
 */

import { useState, useEffect, useCallback } from 'react';
import { useCameraPermission } from 'react-native-vision-camera';
import { debugLog } from '../../../utils/debug';

/**
 * Camera permissions return value
 */
export interface UseCameraPermissionsReturn {
  /** Whether camera permission is granted */
  hasPermission: boolean;
  /** Request camera permission */
  requestPermission: () => Promise<void>;
  /** Whether permission request is in progress */
  isLoading: boolean;
}

/**
 * Hook for managing camera permissions
 *
 * Features:
 * - Automatic permission state management
 * - Permission request handling
 * - Loading state tracking
 *
 * @returns Camera permission state and methods
 */
export function useCameraPermissions(): UseCameraPermissionsReturn {
  const { hasPermission, requestPermission: requestCameraPermission } = useCameraPermission();
  const [isLoading, setIsLoading] = useState(false);

  // Request camera permission
  const requestPermission = useCallback(async () => {
    if (hasPermission) {
      debugLog('useCameraPermissions', 'Camera permission already granted');
      return;
    }

    setIsLoading(true);
    try {
      const result = await requestCameraPermission();
      debugLog('useCameraPermissions', 'Camera permission request result:', result);
    } catch (error) {
      debugLog('useCameraPermissions', 'Camera permission request failed', error);
    } finally {
      setIsLoading(false);
    }
  }, [hasPermission, requestCameraPermission]);

  // Log permission state changes
  useEffect(() => {
    debugLog('useCameraPermissions', 'Permission state changed:', { hasPermission });
  }, [hasPermission]);

  return {
    hasPermission,
    requestPermission,
    isLoading,
  };
}
