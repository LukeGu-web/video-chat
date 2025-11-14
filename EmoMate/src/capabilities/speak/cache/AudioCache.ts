// src/capabilities/speak/cache/AudioCache.ts

import { Directory, File, Paths } from 'expo-file-system';
import { IAudioCache, AudioCacheEntry } from '../../../types/speak';
import { ensureDirectoryExists, safeDeleteFile } from '../../../utils/fileSystemHelpers';

/**
 * Audio cache implementation
 * Manages TTS audio file caching with LRU eviction
 */
export class AudioCache implements IAudioCache {
  private cache: Map<string, AudioCacheEntry> = new Map();
  private maxCacheSize = 30; // Maximum number of cached items
  private cacheDir = new Directory(Paths.document, 'tts_cache');
  private hits = 0;
  private misses = 0;

  /**
   * Initialize cache directory
   */
  async initialize(): Promise<void> {
    try {
      ensureDirectoryExists(this.cacheDir);
      console.log('[AudioCache] Cache directory initialized');
    } catch (error) {
      console.error('[AudioCache] Failed to create cache directory:', error);
      throw error;
    }
  }

  /**
   * Get cached audio for text
   * @param text Text key
   */
  async get(text: string): Promise<AudioCacheEntry | null> {
    const entry = this.cache.get(text);
    if (!entry) {
      this.misses++;
      return null;
    }

    // Update last accessed time
    entry.lastAccessed = Date.now();

    // Verify file still exists
    const file = new File(entry.uri);
    if (!file.exists) {
      console.warn('[AudioCache] Cached file missing, removing from cache:', text);
      this.cache.delete(text);
      this.misses++;
      return null;
    }

    this.hits++;
    console.log(`[AudioCache] ✅ Cache hit: "${text}"`);
    return entry;
  }

  /**
   * Set cached audio for text
   * @param text Text key
   * @param uri Audio file URI
   */
  async set(text: string, uri: string): Promise<void> {
    // Check cache size limit
    if (this.cache.size >= this.maxCacheSize) {
      await this.evictOldest();
    }

    // Get file size
    const file = new File(uri);
    const size = file.exists ? file.size : 0;

    this.cache.set(text, {
      uri,
      text,
      lastAccessed: Date.now(),
      size,
    });

    console.log(`[AudioCache] Cached: "${text}" (${size} bytes)`);
  }

  /**
   * Pre-cache common phrases
   * @param phrases Phrases to cache
   * @param synthesizeFn Synthesis function
   */
  async preCachePhrases(
    phrases: string[],
    synthesizeFn: (text: string) => Promise<string>
  ): Promise<void> {
    console.log('[AudioCache] Pre-caching common phrases...');

    let successCount = 0;
    for (const phrase of phrases) {
      try {
        // Skip if already cached
        if (this.cache.has(phrase)) {
          console.log(`[AudioCache] Already cached: "${phrase}"`);
          continue;
        }

        // Synthesize and cache
        const uri = await synthesizeFn(phrase);
        await this.set(phrase, uri);
        successCount++;

        // Add small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (error) {
        console.warn(`[AudioCache] Failed to cache phrase "${phrase}":`, error);
      }
    }

    console.log(`[AudioCache] ✅ Pre-cached ${successCount}/${phrases.length} phrases`);
  }

  /**
   * Clear all cache
   */
  async clear(): Promise<void> {
    for (const entry of this.cache.values()) {
      try {
        await safeDeleteFile(entry.uri);
      } catch (e) {
        console.warn('[AudioCache] Failed to cleanup cache entry:', e);
      }
    }
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
    console.log('[AudioCache] Cache cleared');
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    hitRate: number;
  } {
    const total = this.hits + this.misses;
    const hitRate = total > 0 ? this.hits / total : 0;

    return {
      size: this.cache.size,
      hitRate,
    };
  }

  /**
   * Evict least recently used item
   */
  private async evictOldest(): Promise<void> {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      const entry = this.cache.get(oldestKey);
      if (entry) {
        try {
          await safeDeleteFile(entry.uri);
          this.cache.delete(oldestKey);
          console.log(`[AudioCache] Evicted: "${oldestKey}"`);
        } catch (e) {
          console.error(`[AudioCache] Failed to evict "${oldestKey}":`, e);
          // Still remove from cache to prevent memory leak
          this.cache.delete(oldestKey);
        }
      }
    }
  }
}

// Global cache instance
export const globalAudioCache = new AudioCache();

/**
 * Initialize global TTS cache
 */
export async function initializeTTSCache(): Promise<void> {
  await globalAudioCache.initialize();
}

/**
 * Pre-cache common phrases using global cache
 */
export async function preCacheCommonPhrases(
  phrases: string[],
  synthesizeFn: (text: string) => Promise<string>
): Promise<void> {
  await globalAudioCache.preCachePhrases(phrases, synthesizeFn);
}
