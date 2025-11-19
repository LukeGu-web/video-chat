import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { debugLog } from '../utils/debug';

interface UseAppStateSceneTimerProps {
  sceneUnderstanding: {
    startTimer: () => void;
    stopTimer: () => void;
  };
  enabled?: boolean;
}

/**
 * useAppStateSceneTimer - Hook to manage scene detection timer based on app state
 *
 * Features:
 * - Starts scene timer when app becomes active
 * - Stops scene timer when app goes to background
 * - Automatically handles cleanup on unmount
 *
 * Usage:
 * ```tsx
 * useAppStateSceneTimer({
 *   sceneUnderstanding,
 *   enabled: true
 * });
 * ```
 */
export const useAppStateSceneTimer = ({
  sceneUnderstanding,
  enabled = true,
}: UseAppStateSceneTimerProps): void => {
  const sceneUnderstandingRef = useRef(sceneUnderstanding);
  const hasInitializedRef = useRef(false);

  // Update ref when sceneUnderstanding changes
  useEffect(() => {
    sceneUnderstandingRef.current = sceneUnderstanding;
  }, [sceneUnderstanding]);

  useEffect(() => {
    if (!enabled) return;

    const subscription = AppState.addEventListener(
      'change',
      (nextAppState: AppStateStatus) => {
        if (nextAppState === 'active') {
          debugLog('useAppStateSceneTimer', 'App active - starting scene timer');
          sceneUnderstandingRef.current.startTimer();
        } else if (
          nextAppState === 'background' ||
          nextAppState === 'inactive'
        ) {
          debugLog('useAppStateSceneTimer', 'App background - stopping scene timer');
          sceneUnderstandingRef.current.stopTimer();
        }
      }
    );

    // Start timer if app is currently active (only once)
    if (AppState.currentState === 'active' && !hasInitializedRef.current) {
      hasInitializedRef.current = true;
      debugLog('useAppStateSceneTimer', 'Initial app state: active - starting scene timer');
      sceneUnderstandingRef.current.startTimer();
    }

    return () => {
      subscription.remove();
      sceneUnderstandingRef.current.stopTimer();
    };
    // Only depend on enabled, use ref for sceneUnderstanding
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);
};
