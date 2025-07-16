import { useState, useEffect } from 'react';
import { useCameraPermissions } from 'expo-camera';

export interface CameraPermissionState {
  hasPermission: boolean;
  isLoading: boolean;
  error: string | null;
  requestPermission: () => Promise<void>;
}

export function useExpoCameraPermission(): CameraPermissionState {
  const [permission, requestPermission] = useCameraPermissions();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleRequestPermission = async () => {
    try {
      setIsLoading(true);
      setError(null);
      await requestPermission();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to request camera permission');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (permission) {
      setIsLoading(false);
      if (!permission.granted && permission.canAskAgain === false) {
        setError('Camera permission permanently denied. Please enable in settings.');
      }
    }
  }, [permission]);

  return {
    hasPermission: permission?.granted ?? false,
    isLoading,
    error,
    requestPermission: handleRequestPermission
  };
}