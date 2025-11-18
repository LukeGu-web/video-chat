/**
 * Camera device management hook
 * Manages camera device selection and switching
 */

import { useState, useCallback } from 'react';
import { useCameraDevice, type CameraDevice } from 'react-native-vision-camera';
import { debugLog } from '../../../utils/debug';

/**
 * Camera position type
 */
export type CameraPosition = 'front' | 'back';

/**
 * Camera hook return value
 */
export interface UseCameraReturn {
  /** Current camera device */
  device: CameraDevice | undefined;
  /** Current camera position */
  position: CameraPosition;
  /** Switch between front and back camera */
  switchCamera: () => void;
  /** Whether camera is ready */
  isReady: boolean;
}

/**
 * Hook for managing camera device
 *
 * Features:
 * - Front/back camera selection
 * - Camera switching
 * - Device readiness tracking
 *
 * @param initialPosition - Initial camera position (default: 'front')
 * @returns Camera device state and methods
 */
export function useCamera(initialPosition: CameraPosition = 'front'): UseCameraReturn {
  const [position, setPosition] = useState<CameraPosition>(initialPosition);

  // Get camera device for current position
  const device = useCameraDevice(position);

  // Switch between front and back camera
  const switchCamera = useCallback(() => {
    const newPosition = position === 'front' ? 'back' : 'front';
    setPosition(newPosition);
    debugLog('useCamera', `Switching camera to: ${newPosition}`);
  }, [position]);

  return {
    device,
    position,
    switchCamera,
    isReady: !!device,
  };
}
