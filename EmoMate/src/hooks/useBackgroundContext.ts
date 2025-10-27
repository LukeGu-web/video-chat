/**
 * Background Context Hook
 *
 * Manages background scene selection and story generation for the AI companion.
 * Automatically selects appropriate scenes based on time, day type, and weather,
 * and generates contextual background stories for enhanced AI interactions.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  generateBackgroundContext,
  shouldRefreshBackground,
  type BackgroundContext,
} from '../utils/backgroundStory';

export interface UseBackgroundContextReturn {
  context: BackgroundContext | null;
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

export function useBackgroundContext(): UseBackgroundContextReturn {
  const [context, setContext] = useState<BackgroundContext | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Initialize background context on mount
  const initialize = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const newContext = await generateBackgroundContext();
      setContext(newContext);
      console.log('[BackgroundContext] Initialized:', {
        scene: newContext.scene.id,
        story: newContext.story.substring(0, 50) + '...',
      });
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to generate background context');
      setError(error);
      console.error('[BackgroundContext] Initialization failed:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Auto-refresh background context every 5 minutes if needed (30-minute threshold)
  useEffect(() => {
    const checkInterval = setInterval(async () => {
      if (context && shouldRefreshBackground(context.timestamp)) {
        console.log('[BackgroundContext] Auto-refresh triggered (30 minutes elapsed)');
        try {
          const newContext = await generateBackgroundContext();
          setContext(newContext);
          console.log('[BackgroundContext] Auto-refreshed:', {
            scene: newContext.scene.id,
            story: newContext.story.substring(0, 50) + '...',
          });
        } catch (err) {
          console.error('[BackgroundContext] Auto-refresh failed:', err);
          // Don't set error state on auto-refresh failure to avoid disrupting user
        }
      }
    }, 5 * 60 * 1000); // Check every 5 minutes

    return () => clearInterval(checkInterval);
  }, [context]);

  // Initialize on mount
  useEffect(() => {
    initialize();
  }, [initialize]);

  // Manual refresh function
  const refresh = useCallback(async () => {
    await initialize();
  }, [initialize]);

  return {
    context,
    isLoading,
    error,
    refresh,
  };
}
