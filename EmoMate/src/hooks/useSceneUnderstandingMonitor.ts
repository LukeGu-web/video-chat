import { useEffect } from 'react';
import { useMonitorStore } from '../store/monitorStore';
import { useSceneStore } from '../store';
import { useDebounce } from './useDebounce';
import { debugLog } from '../utils/debug';
import { SceneData } from '../types/scene';

/**
 * Scene understanding object type (simplified from UseSceneUnderstandingReturn)
 */
interface SceneUnderstanding {
  isAnalyzing: boolean;
  totalAPICalls: number;
  currentScene: SceneData | null;
  timerState: {
    enabled: boolean;
    nextCaptureIn: number;
  };
}

/**
 * useSceneUnderstandingMonitor Hook
 * Monitors scene understanding state and syncs to stores
 * Consolidates 2 useEffects into a single hook
 */
export const useSceneUnderstandingMonitor = (
  sceneUnderstanding: SceneUnderstanding
) => {
  const updateSceneUnderstanding = useMonitorStore(
    (state) => state.updateSceneUnderstanding
  );
  const setCurrentScene = useSceneStore((state) => state.setCurrentScene);

  // 1. Sync scene understanding status to monitor context (with debounce)
  // Debounced update to avoid excessive re-renders from frequent timer updates
  const debouncedUpdateSceneUnderstanding = useDebounce(
    (data: {
      isAnalyzing: boolean;
      totalAPICalls: number;
      currentLocation: string | null;
      timerEnabled: boolean;
      nextCaptureInSeconds: number;
    }) => {
      updateSceneUnderstanding(data);
    },
    500 // 500ms debounce delay
  );

  useEffect(() => {
    debouncedUpdateSceneUnderstanding({
      isAnalyzing: sceneUnderstanding.isAnalyzing,
      totalAPICalls: sceneUnderstanding.totalAPICalls,
      currentLocation: sceneUnderstanding.currentScene?.location || null,
      timerEnabled: sceneUnderstanding.timerState.enabled,
      nextCaptureInSeconds: Math.floor(
        sceneUnderstanding.timerState.nextCaptureIn / 1000
      ),
    });
  }, [
    sceneUnderstanding.isAnalyzing,
    sceneUnderstanding.totalAPICalls,
    sceneUnderstanding.currentScene?.location,
    sceneUnderstanding.timerState.enabled,
    sceneUnderstanding.timerState.nextCaptureIn,
    debouncedUpdateSceneUnderstanding,
  ]);

  // 2. Monitor scene updates and sync to userStore
  useEffect(() => {
    const current = sceneUnderstanding.currentScene;
    if (current) {
      setCurrentScene(current);
      debugLog('useSceneUnderstandingMonitor', `Scene updated: ${current.location}`);
    }
  }, [sceneUnderstanding.currentScene, setCurrentScene]);
};
