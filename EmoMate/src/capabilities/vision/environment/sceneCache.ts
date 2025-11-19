/**
 * Scene Cache Management Module
 * Handles caching, storage, and retrieval of scene data
 * Now uses Zustand store for state management
 */

import { SceneData, SceneConfig, SceneCacheEntry } from '../../../types/scene';
import { compareImages, generateThumbnail } from '../imageComparison';
import { debugError } from '../../../utils/debug';
import { useSceneStore } from '../../../store/sceneStore';

/**
 * Load cached scene data from storage
 * Automatically cleans up expired scenes on load
 *
 * @returns Object containing loaded cache, last scene, and config
 */
export function loadCachedData(): {
  cache: SceneCacheEntry[];
  lastScene: SceneData | null;
  config: Partial<SceneConfig> | null;
} {
  const store = useSceneStore.getState();
  return {
    cache: store.cache,
    lastScene: store.lastScene,
    config: store.config,
  };
}

/**
 * Save scene data to cache (Step 4.1)
 * Implements cache capacity control (max 3 scenes) and expiration
 *
 * @param cache - Current cache array (will be modified)
 * @param scene - Scene data to cache
 * @param imageThumbnail - Thumbnail of the scene image
 * @param config - Scene configuration with cache expiration setting
 * @returns Updated cache array
 */
export function saveToCache(
  cache: SceneCacheEntry[],
  scene: SceneData,
  imageThumbnail: string,
  config: SceneConfig
): SceneCacheEntry[] {
  try {
    const store = useSceneStore.getState();
    store.saveToCache(scene, imageThumbnail, config);
    return store.cache;
  } catch (error) {
    debugError('SceneCache', 'Failed to save cache', error);
    return cache;
  }
}

/**
 * Save last scene to storage
 *
 * @param scene - Scene data to save
 */
export function saveLastScene(scene: SceneData): void {
  try {
    const store = useSceneStore.getState();
    store.saveLastScene(scene);
  } catch (error) {
    debugError('SceneCache', 'Failed to save last scene', error);
  }
}

/**
 * Save configuration to storage
 *
 * @param config - Scene configuration to save
 */
export function saveConfig(config: SceneConfig): void {
  try {
    const store = useSceneStore.getState();
    store.saveConfig(config);
  } catch (error) {
    debugError('SceneCache', 'Failed to save config', error);
  }
}

/**
 * Check if scene is in cache (deduplication)
 * Returns both the cached scene and the similarity score
 *
 * @param cache - Array of cached scenes
 * @param imageBase64 - Base64 encoded image to check
 * @param deduplicationThreshold - Similarity threshold for deduplication
 * @returns Object with cached scene and similarity score
 */
export async function checkCache(
  cache: SceneCacheEntry[],
  imageBase64: string,
  deduplicationThreshold: number
): Promise<{ scene: SceneData | null; similarity: number | null }> {
  try {
    // Generate thumbnail for comparison
    const thumbnail = await generateThumbnail(imageBase64);

    const now = Date.now();

    // Check against cached scenes
    for (const entry of cache) {
      if (!entry.imageThumbnail) continue;

      // Skip expired scenes - they should not be used for deduplication
      if (entry.expiresAt <= now) {
        continue;
      }

      const comparison = await compareImages(
        thumbnail,
        entry.imageThumbnail,
        deduplicationThreshold
      );

      if (comparison.isSameScene) {
        return { scene: entry.scene, similarity: comparison.similarity };
      }
    }

    return { scene: null, similarity: null };
  } catch (error) {
    debugError('SceneCache', 'Cache check failed', error);
    return { scene: null, similarity: null };
  }
}

/**
 * Clear all cached scenes
 *
 * @returns Empty cache array
 */
export function clearCache(): SceneCacheEntry[] {
  try {
    const store = useSceneStore.getState();
    store.clearCache();
    return [];
  } catch (error) {
    debugError('SceneCache', 'Failed to clear cache', error);
    return [];
  }
}

/**
 * Manually clear expired scenes from cache (Step 4.1)
 * Removes all scenes that have passed their expiration time
 *
 * @param cache - Current cache array
 * @returns Object with updated cache and number of removed scenes
 */
export function clearExpiredScenes(cache: SceneCacheEntry[]): {
  updatedCache: SceneCacheEntry[];
  removedCount: number;
} {
  try {
    const store = useSceneStore.getState();
    const { removedCount } = store.clearExpiredScenes();
    return {
      updatedCache: store.cache,
      removedCount,
    };
  } catch (error) {
    debugError('SceneCache', 'Failed to clear expired scenes', error);
    return { updatedCache: cache, removedCount: 0 };
  }
}
