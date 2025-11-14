// src/types/speak/cache.ts

import { AudioCacheEntry } from './common';

/**
 * Audio cache interface
 */
export interface IAudioCache {
  /**
   * Initialize cache
   */
  initialize(): Promise<void>;

  /**
   * Get cached audio
   * @param text Text key
   */
  get(text: string): Promise<AudioCacheEntry | null>;

  /**
   * Set cached audio
   * @param text Text key
   * @param uri Audio file URI
   */
  set(text: string, uri: string): Promise<void>;

  /**
   * Pre-cache common phrases
   * @param phrases Phrases to cache
   * @param synthesizeFn Synthesis function
   */
  preCachePhrases(
    phrases: string[],
    synthesizeFn: (text: string) => Promise<string>
  ): Promise<void>;

  /**
   * Clear all cache
   */
  clear(): Promise<void>;

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    hitRate: number;
  };
}
