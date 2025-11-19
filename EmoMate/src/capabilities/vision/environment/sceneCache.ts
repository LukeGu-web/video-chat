/**
 * Scene Cache Management Module
 * Handles caching, storage, and retrieval of scene data
 */

import { createMMKV } from 'react-native-mmkv';
import { SceneData, SceneConfig, SceneCacheEntry } from '../../../types/scene';
import { compareImages, generateThumbnail } from '../imageComparison';
import { debugError } from '../../../utils/debug';

/**
 * MMKV Storage instance for scene understanding data
 */
export const storage = createMMKV({
  id: 'scene-understanding-storage',
  encryptionKey: 'scene-understanding-encryption-key', // Optional: for data encryption
});

/**
 * Storage keys for persisting scene data
 */
export const STORAGE_KEYS = {
  SCENE_CACHE: 'scene_understanding_cache',
  LAST_SCENE: 'scene_understanding_last_scene',
  CONFIG: 'scene_understanding_config',
};

/**
 * Load cached scene data from MMKV storage
 * Automatically cleans up expired scenes on load
 *
 * @returns Object containing loaded cache, last scene, and config
 */
export function loadCachedData(): {
  cache: SceneCacheEntry[];
  lastScene: SceneData | null;
  config: Partial<SceneConfig> | null;
} {
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

    return { cache, lastScene, config };
  } catch (error) {
    debugError('SceneCache', 'Failed to load cached data', error);
    return { cache: [], lastScene: null, config: null };
  }
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
    const cacheEntry: SceneCacheEntry = {
      scene,
      cachedAt: Date.now(),
      expiresAt: Date.now() + config.cacheExpiration,
      imageThumbnail,
    };

    // Add to cache
    const updatedCache = [...cache, cacheEntry];

    // Remove expired entries (Step 4.1: auto cleanup)
    const filteredCache = updatedCache.filter(
      entry => entry.expiresAt > Date.now()
    );

    // Step 4.1: Enforce max cache size (keep most recent 3 scenes)
    const MAX_CACHE_SIZE = 3;
    let finalCache = filteredCache;
    if (filteredCache.length > MAX_CACHE_SIZE) {
      // Sort by cachedAt timestamp (newest first)
      finalCache = filteredCache.sort((a, b) => b.cachedAt - a.cachedAt);
      // Keep only the most recent MAX_CACHE_SIZE entries
      finalCache = finalCache.slice(0, MAX_CACHE_SIZE);
    }

    // Save to MMKV storage
    storage.set(STORAGE_KEYS.SCENE_CACHE, JSON.stringify(finalCache));

    return finalCache;
  } catch (error) {
    debugError('SceneCache', 'Failed to save cache', error);
    return cache;
  }
}

/**
 * Save last scene to MMKV storage
 *
 * @param scene - Scene data to save
 */
export function saveLastScene(scene: SceneData): void {
  try {
    storage.set(STORAGE_KEYS.LAST_SCENE, JSON.stringify(scene));
  } catch (error) {
    debugError('SceneCache', 'Failed to save last scene', error);
  }
}

/**
 * Save configuration to MMKV storage
 *
 * @param config - Scene configuration to save
 */
export function saveConfig(config: SceneConfig): void {
  try {
    storage.set(STORAGE_KEYS.CONFIG, JSON.stringify(config));
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
    storage.remove(STORAGE_KEYS.SCENE_CACHE);
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
    const beforeCount = cache.length;
    const now = Date.now();

    // Filter out expired entries
    const updatedCache = cache.filter(entry => entry.expiresAt > now);

    // Sort by cachedAt timestamp (newest first)
    updatedCache.sort((a, b) => b.cachedAt - a.cachedAt);

    const afterCount = updatedCache.length;
    const removedCount = beforeCount - afterCount;

    // Save updated cache to storage
    storage.set(STORAGE_KEYS.SCENE_CACHE, JSON.stringify(updatedCache));

    return { updatedCache, removedCount };
  } catch (error) {
    debugError('SceneCache', 'Failed to clear expired scenes', error);
    return { updatedCache: cache, removedCount: 0 };
  }
}
