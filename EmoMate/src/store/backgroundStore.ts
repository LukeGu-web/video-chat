/**
 * Background Context Store
 *
 * Manages background scene selection and story generation for the AI companion.
 * Automatically selects appropriate scenes based on time, day type, and weather,
 * and generates contextual background stories for enhanced AI interactions.
 *
 * Usage:
 * ```tsx
 * import { useBackgroundStore } from '../store';
 * import { shouldRefreshBackground } from '../utils/backgroundStory';
 *
 * const { context, isLoading, error, initialize, refresh } = useBackgroundStore();
 *
 * useEffect(() => {
 *   initialize();
 * }, [initialize]);
 *
 * // Auto-refresh logic (optional)
 * useEffect(() => {
 *   const interval = setInterval(async () => {
 *     if (context && shouldRefreshBackground(context.timestamp)) {
 *       await refresh();
 *     }
 *   }, 5 * 60 * 1000);
 *   return () => clearInterval(interval);
 * }, [context, refresh]);
 * ```
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import {
  generateBackgroundContext,
  type BackgroundContext,
} from '../utils/backgroundStory';
import { debugLog, debugError } from '../utils/debug';

interface BackgroundState {
  context: BackgroundContext | null;
  isLoading: boolean;
  error: Error | null;
}

interface BackgroundActions {
  initialize: () => Promise<void>;
  refresh: () => Promise<void>;
  setContext: (context: BackgroundContext) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: Error | null) => void;
  reset: () => void;
}

type BackgroundStore = BackgroundState & BackgroundActions;

const initialState: BackgroundState = {
  context: null,
  isLoading: true,
  error: null,
};

export const useBackgroundStore = create<BackgroundStore>()(
  immer((set) => ({
    ...initialState,

    initialize: async () => {
      try {
        set((state) => {
          state.isLoading = true;
          state.error = null;
        });

        const newContext = await generateBackgroundContext();

        set((state) => {
          state.context = newContext;
          state.isLoading = false;
        });

        debugLog('BackgroundStore', 'Initialized:', {
          scene: newContext.scene.id,
          story: newContext.story.substring(0, 50) + '...',
        });
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to generate background context');

        set((state) => {
          state.error = error;
          state.isLoading = false;
        });

        debugError('BackgroundStore', 'Initialization failed:', error);
      }
    },

    refresh: async () => {
      try {
        set((state) => {
          state.isLoading = true;
          state.error = null;
        });

        const newContext = await generateBackgroundContext();

        set((state) => {
          state.context = newContext;
          state.isLoading = false;
        });

        debugLog('BackgroundStore', 'Refreshed:', {
          scene: newContext.scene.id,
          story: newContext.story.substring(0, 50) + '...',
        });
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to refresh background context');

        set((state) => {
          state.error = error;
          state.isLoading = false;
        });

        debugError('BackgroundStore', 'Refresh failed:', error);
      }
    },

    setContext: (context: BackgroundContext) => {
      set((state) => {
        state.context = context;
      });
    },

    setLoading: (isLoading: boolean) => {
      set((state) => {
        state.isLoading = isLoading;
      });
    },

    setError: (error: Error | null) => {
      set((state) => {
        state.error = error;
      });
    },

    reset: () => {
      set((state) => {
        state.context = initialState.context;
        state.isLoading = initialState.isLoading;
        state.error = initialState.error;
      });
    },
  }))
);
