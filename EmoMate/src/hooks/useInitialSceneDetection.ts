import { useEffect, useRef } from 'react';
import { debugLog, debugWarn, debugError } from '../utils/debug';

// Constants for scene detection timing
const SCENE_CACHE_DURATION_MS = 30 * 60 * 1000; // 30 minutes
const FRAME_POLL_INTERVAL_MS = 2000; // 2 seconds
const MAX_FRAME_WAIT_ATTEMPTS = 15; // 15 attempts = 30 seconds

// Scene type definition
interface Scene {
  location: string;
  timestamp: number;
  [key: string]: any; // Allow additional properties
}

interface UseInitialSceneDetectionProps {
  sceneUnderstanding: {
    currentScene: Scene | null;
    analyzeScene: (frameBase64: string, reason?: string) => Promise<void>;
  };
  getCapturedFrame: () => string | null;
  enabled?: boolean;
}

/**
 * useInitialSceneDetection - Hook for initial scene detection on app startup
 *
 * Features:
 * - Checks for cached scene validity (30 minutes)
 * - Polls for camera frame availability (max 30 seconds)
 * - Automatically triggers scene analysis when frame is ready
 *
 * Usage:
 * ```tsx
 * useInitialSceneDetection({
 *   sceneUnderstanding,
 *   getCapturedFrame: () => lastCapturedFrameRef.current,
 *   enabled: true
 * });
 * ```
 */
export const useInitialSceneDetection = ({
  sceneUnderstanding,
  getCapturedFrame,
  enabled = true,
}: UseInitialSceneDetectionProps): void => {
  const hasRunRef = useRef(false);
  const getCapturedFrameRef = useRef(getCapturedFrame);

  // Update ref when getCapturedFrame changes
  useEffect(() => {
    getCapturedFrameRef.current = getCapturedFrame;
  }, [getCapturedFrame]);

  useEffect(() => {
    if (!enabled || hasRunRef.current) return;

    hasRunRef.current = true;
    let checkFrameInterval: NodeJS.Timeout | null = null;
    let isAnalyzing = false;

    const performInitialSceneDetection = async () => {
      // Check if we have a valid cached scene
      const cached = sceneUnderstanding.currentScene;
      const hasValidScene =
        cached &&
        cached.timestamp &&
        Date.now() - cached.timestamp < SCENE_CACHE_DURATION_MS;

      if (hasValidScene && cached) {
        debugLog('useInitialSceneDetection', `Using cached scene: ${cached.location}`);
        return;
      }

      debugLog('useInitialSceneDetection', 'Waiting for camera frame for initial scene detection');

      // Poll for camera frame availability
      let attempts = 0;

      checkFrameInterval = setInterval(async () => {
        attempts++;

        const frame = getCapturedFrameRef.current();

        if (frame && !isAnalyzing) {
          // Frame available and not currently analyzing - start analysis
          if (checkFrameInterval) {
            clearInterval(checkFrameInterval);
            checkFrameInterval = null;
          }

          isAnalyzing = true;
          debugLog('useInitialSceneDetection', 'Starting initial scene detection');

          try {
            await sceneUnderstanding.analyzeScene(frame, undefined);
            debugLog('useInitialSceneDetection', 'Initial scene detection completed');
          } catch (error) {
            debugError('useInitialSceneDetection', 'Initial scene detection failed', error);
          } finally {
            isAnalyzing = false;
          }
        } else if (attempts >= MAX_FRAME_WAIT_ATTEMPTS) {
          // Timeout reached
          debugWarn('useInitialSceneDetection', 'Timeout waiting for camera frame');
          if (checkFrameInterval) {
            clearInterval(checkFrameInterval);
            checkFrameInterval = null;
          }
        }
      }, FRAME_POLL_INTERVAL_MS);
    };

    performInitialSceneDetection();

    // Proper cleanup function for useEffect
    return () => {
      if (checkFrameInterval) {
        clearInterval(checkFrameInterval);
        checkFrameInterval = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);
};
