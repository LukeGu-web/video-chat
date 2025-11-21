/**
 * Scene Store - Zustand with MMKV Persistence
 * Manages scene understanding data with automatic persistence
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { createMMKV } from 'react-native-mmkv';
import { SceneData, SceneConfig, SceneCacheEntry } from '../types/scene';
import { debugLog, debugError } from '../utils/debug';

// ============================================
// MMKV Storage Instance
// ============================================

const storage = createMMKV({
  id: 'scene-understanding-storage',
  encryptionKey: 'scene-understanding-encryption-key',
});

// ============================================
// Storage Keys
// ============================================

const STORAGE_KEYS = {
  SCENE_CACHE: 'scene_understanding_cache',
  LAST_SCENE: 'scene_understanding_last_scene',
  CONFIG: 'scene_understanding_config',
} as const;

// ============================================
// Store Interface
// ============================================

interface SceneStoreState {
  cache: SceneCacheEntry[];
  lastScene: SceneData | null;
  config: Partial<SceneConfig> | null;
  currentScene: SceneData | null; // Current active scene
}

interface SceneStoreActions {
  // Load data from MMKV
  loadFromStorage: () => void;

  // Save operations
  saveToCache: (
    scene: SceneData,
    imageThumbnail: string,
    config: SceneConfig
  ) => void;
  saveLastScene: (scene: SceneData) => void;
  saveConfig: (config: SceneConfig) => void;

  // Current scene management
  setCurrentScene: (scene: SceneData | null) => void;

  // Cache management
  clearCache: () => void;
  clearExpiredScenes: () => { removedCount: number };

  // Reset
  reset: () => void;
}

type SceneStore = SceneStoreState & SceneStoreActions;

// ============================================
// Initial State
// ============================================

const initialState: SceneStoreState = {
  cache: [],
  lastScene: null,
  config: null,
  currentScene: null,
};

// ============================================
// Helper Functions
// ============================================

/**
 * Load cached data from MMKV storage
 */
function loadCachedData(): SceneStoreState {
  try {
    const now = Date.now();
    let cache: SceneCacheEntry[] = [];
    let lastScene: SceneData | null = null;
    let config: Partial<SceneConfig> | null = null;

    // Load scene cache
    const cacheJson = storage.getString(STORAGE_KEYS.SCENE_CACHE);
    if (cacheJson) {
      const loadedCache = JSON.parse(cacheJson);
      const beforeCount = loadedCache.length;

      // Automatically clean up expired scenes on load
      cache = loadedCache.filter(
        (entry: SceneCacheEntry) => entry.expiresAt > now
      );

      // Sort by cachedAt timestamp (newest first)
      cache.sort((a, b) => b.cachedAt - a.cachedAt);

      const afterCount = cache.length;
      const removedCount = beforeCount - afterCount;

      if (removedCount > 0) {
        debugLog(
          'SceneStore',
          `Removed ${removedCount} expired scenes on load`
        );
        // Save cleaned cache back to storage
        storage.set(STORAGE_KEYS.SCENE_CACHE, JSON.stringify(cache));
      }
    }

    // Load last scene
    const lastSceneJson = storage.getString(STORAGE_KEYS.LAST_SCENE);
    if (lastSceneJson) {
      lastScene = JSON.parse(lastSceneJson);
    }

    // Load config
    const configJson = storage.getString(STORAGE_KEYS.CONFIG);
    if (configJson) {
      config = JSON.parse(configJson);
    }

    debugLog('SceneStore', 'Loaded cached data from storage', {
      cacheSize: cache.length,
      hasLastScene: !!lastScene,
      hasConfig: !!config,
    });

    return { cache, lastScene, config, currentScene: null };
  } catch (error) {
    debugError('SceneStore', 'Failed to load cached data', error);
    return initialState;
  }
}

// ============================================
// Store Definition
// ============================================

export const useSceneStore = create<SceneStore>()(
  immer((set) => ({
    ...initialState,

    loadFromStorage: () => {
      const data = loadCachedData();
      set((state) => {
        state.cache = data.cache;
        state.lastScene = data.lastScene;
        state.config = data.config;
      });
    },

    saveToCache: (
      scene: SceneData,
      imageThumbnail: string,
      config: SceneConfig
    ) => {
      try {
        const cacheEntry: SceneCacheEntry = {
          scene,
          cachedAt: Date.now(),
          expiresAt: Date.now() + config.cacheExpiration,
          imageThumbnail,
        };

        set((state) => {
          // Add to cache
          state.cache.push(cacheEntry);

          // Remove expired entries
          const now = Date.now();
          state.cache = state.cache.filter(
            (entry) => entry.expiresAt > now
          );

          // Enforce max cache size (keep most recent 3 scenes)
          const MAX_CACHE_SIZE = 3;
          if (state.cache.length > MAX_CACHE_SIZE) {
            // Sort by cachedAt timestamp (newest first)
            state.cache.sort((a, b) => b.cachedAt - a.cachedAt);
            // Keep only the most recent MAX_CACHE_SIZE entries
            state.cache = state.cache.slice(0, MAX_CACHE_SIZE);
          }

          // Save to MMKV storage
          storage.set(STORAGE_KEYS.SCENE_CACHE, JSON.stringify(state.cache));

          debugLog('SceneStore', 'Saved scene to cache', {
            cacheSize: state.cache.length,
            sceneLocation: scene.location,
          });
        });
      } catch (error) {
        debugError('SceneStore', 'Failed to save to cache', error);
      }
    },

    saveLastScene: (scene: SceneData) => {
      try {
        set((state) => {
          state.lastScene = scene;
        });
        storage.set(STORAGE_KEYS.LAST_SCENE, JSON.stringify(scene));
        debugLog('SceneStore', 'Saved last scene', { sceneLocation: scene.location });
      } catch (error) {
        debugError('SceneStore', 'Failed to save last scene', error);
      }
    },

    saveConfig: (config: SceneConfig) => {
      try {
        set((state) => {
          state.config = config;
        });
        storage.set(STORAGE_KEYS.CONFIG, JSON.stringify(config));
        debugLog('SceneStore', 'Saved config');
      } catch (error) {
        debugError('SceneStore', 'Failed to save config', error);
      }
    },

    setCurrentScene: (scene: SceneData | null) => {
      set((state) => {
        state.currentScene = scene;
      });
      debugLog('SceneStore', 'Set current scene', {
        sceneLocation: scene?.location || 'null'
      });
    },

    clearCache: () => {
      try {
        set((state) => {
          state.cache = [];
        });
        storage.remove(STORAGE_KEYS.SCENE_CACHE);
        debugLog('SceneStore', 'Cleared cache');
      } catch (error) {
        debugError('SceneStore', 'Failed to clear cache', error);
      }
    },

    clearExpiredScenes: () => {
      try {
        let removedCount = 0;
        set((state) => {
          const beforeCount = state.cache.length;
          const now = Date.now();

          // Filter out expired entries
          state.cache = state.cache.filter((entry) => entry.expiresAt > now);

          // Sort by cachedAt timestamp (newest first)
          state.cache.sort((a, b) => b.cachedAt - a.cachedAt);

          removedCount = beforeCount - state.cache.length;

          // Save updated cache to storage
          storage.set(STORAGE_KEYS.SCENE_CACHE, JSON.stringify(state.cache));
        });

        debugLog('SceneStore', `Cleared ${removedCount} expired scenes`);
        return { removedCount };
      } catch (error) {
        debugError('SceneStore', 'Failed to clear expired scenes', error);
        return { removedCount: 0 };
      }
    },

    reset: () => {
      try {
        set((state) => {
          state.cache = initialState.cache;
          state.lastScene = initialState.lastScene;
          state.config = initialState.config;
          state.currentScene = initialState.currentScene;
        });
        storage.remove(STORAGE_KEYS.SCENE_CACHE);
        storage.remove(STORAGE_KEYS.LAST_SCENE);
        storage.remove(STORAGE_KEYS.CONFIG);
        debugLog('SceneStore', 'Reset store');
      } catch (error) {
        debugError('SceneStore', 'Failed to reset store', error);
      }
    },
  }))
);

// ============================================
// Initialize store on module load
// ============================================

// Load persisted data when store is created
useSceneStore.getState().loadFromStorage();
