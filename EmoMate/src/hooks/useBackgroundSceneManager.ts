import { useEffect, useRef, useMemo } from 'react';
import { useBackgroundStore } from '../store/backgroundStore';
import { useMonitorStore } from '../store/monitorStore';
import { getBackgroundImageSource, shouldRefreshBackground } from '../utils/backgroundStory';
import { debugLog, debugError } from '../utils/debug';

/**
 * useBackgroundSceneManager Hook
 * Manages background scene initialization, auto-refresh, and monitoring
 * Consolidates 3 useEffects into a single hook
 */
export const useBackgroundSceneManager = () => {
  const {
    context: backgroundContext,
    isLoading: isBackgroundLoading,
    error: backgroundError,
    initialize: initializeBackground,
    refresh: refreshBackground,
  } = useBackgroundStore();

  const updateBackgroundScene = useMonitorStore(
    (state) => state.updateBackgroundScene
  );

  // 1. Initialize background context on mount
  useEffect(() => {
    initializeBackground();
  }, [initializeBackground]);

  // 2. Auto-refresh background context every 5 minutes if needed (30-minute threshold)
  // Store latest refreshBackground function in ref to avoid recreating interval
  const refreshBackgroundRef = useRef(refreshBackground);
  useEffect(() => {
    refreshBackgroundRef.current = refreshBackground;
  }, [refreshBackground]);

  useEffect(() => {
    const checkInterval = setInterval(async () => {
      // Get current context from store to avoid recreating interval on every context update
      const currentContext = useBackgroundStore.getState().context;
      if (currentContext && shouldRefreshBackground(currentContext.timestamp)) {
        debugLog('useBackgroundSceneManager', 'Auto-refresh background triggered (30 minutes elapsed)');
        try {
          await refreshBackgroundRef.current();
        } catch (err) {
          debugError('useBackgroundSceneManager', 'Auto-refresh background failed:', err);
          // Don't throw error on auto-refresh failure to avoid disrupting user
        }
      }
    }, 5 * 60 * 1000); // Check every 5 minutes

    return () => clearInterval(checkInterval);
  }, []); // Empty deps - interval only created once on mount

  // 3. Sync background scene to monitor context
  useEffect(() => {
    if (backgroundContext) {
      updateBackgroundScene({
        sceneId: backgroundContext.scene.id,
        dayType: backgroundContext.scene.dayType,
        timePeriod: backgroundContext.scene.timePeriod,
        location: backgroundContext.scene.location,
        weather: backgroundContext.weather,
        storyPreview: backgroundContext.story.substring(0, 60),
      });
    } else {
      updateBackgroundScene(null);
    }
  }, [backgroundContext, updateBackgroundScene]);

  // 4. Compute background image source (memoized)
  const backgroundSource = useMemo(() => {
    return backgroundContext
      ? getBackgroundImageSource(backgroundContext.imagePath)
      : require('../../assets/background/afternoon.jpeg');
  }, [backgroundContext]);

  return {
    backgroundContext,
    isBackgroundLoading,
    backgroundError,
    backgroundSource,
  };
};
