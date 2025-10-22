/**
 * TTS Queue Manager
 * Phase 2 Optimization: Manages asynchronous TTS synthesis and playback queue
 *
 * Features:
 * - Parallel TTS synthesis for multiple sentences
 * - Sequential playback in correct order
 * - ElevenLabs integration with error handling
 * - Graceful cleanup and cancellation
 */

import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import {
  ELEVENLABS_CONFIG,
  getElevenLabsApiKey,
  getEmotionalVoiceSettings,
  getLanLanVoiceId,
  preprocessTextForNaturalSpeech,
} from '../constants/ai';

/**
 * Common phrases to pre-cache for instant playback
 * Phase 3 Optimization: Cache frequently used short responses
 */
const CACHE_PHRASES = [
  "嗯嗯，好的呢~",
  "我明白了~",
  "真的吗？",
  "太好了！",
  "是这样啊~",
  "欸？",
  "让我想想...",
  "嗯...",
  "好呀~",
  "明白了~",
  "没问题呢~",
  "当然可以~",
  "我懂了~",
  "原来如此~",
  "是吗？",
  "哇！",
  "欸嘿嘿~",
  "好的~",
  "收到了~",
  "我知道了~",
] as const;

/**
 * Audio cache interface
 */
interface AudioCacheEntry {
  uri: string;
  sound: Audio.Sound;
  lastAccessed: number;
}

/**
 * Global TTS audio cache
 * Shared across all TTSQueue instances
 */
class TTSAudioCache {
  private cache: Map<string, AudioCacheEntry> = new Map();
  private maxCacheSize = 30; // Maximum number of cached items
  private cacheDir = FileSystem.documentDirectory + 'tts_cache/';

  /**
   * Initialize cache directory
   */
  async initialize(): Promise<void> {
    try {
      const dirInfo = await FileSystem.getInfoAsync(this.cacheDir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(this.cacheDir, { intermediates: true });
        console.log('[TTSCache] Cache directory created');
      }
    } catch (error) {
      console.error('[TTSCache] Failed to create cache directory:', error);
    }
  }

  /**
   * Get cached audio for text
   */
  async get(text: string): Promise<Audio.Sound | null> {
    const entry = this.cache.get(text);
    if (!entry) {
      return null;
    }

    // Update last accessed time
    entry.lastAccessed = Date.now();

    // Verify file still exists
    const fileInfo = await FileSystem.getInfoAsync(entry.uri);
    if (!fileInfo.exists) {
      console.warn('[TTSCache] Cached file missing, removing from cache:', text);
      this.cache.delete(text);
      return null;
    }

    console.log(`[TTSCache] ✅ Cache hit: "${text}"`);
    return entry.sound;
  }

  /**
   * Set cached audio for text
   */
  async set(text: string, uri: string, sound: Audio.Sound): Promise<void> {
    // Check cache size limit
    if (this.cache.size >= this.maxCacheSize) {
      await this.evictOldest();
    }

    this.cache.set(text, {
      uri,
      sound,
      lastAccessed: Date.now(),
    });

    console.log(`[TTSCache] Cached: "${text}"`);
  }

  /**
   * Pre-generate and cache common phrases
   */
  async preCacheCommonPhrases(synthesizeFn: (text: string) => Promise<{ uri: string; sound: Audio.Sound }>): Promise<void> {
    console.log('[TTSCache] Pre-caching common phrases...');

    let successCount = 0;
    for (const phrase of CACHE_PHRASES) {
      try {
        // Skip if already cached
        if (this.cache.has(phrase)) {
          continue;
        }

        // Synthesize and cache
        const { uri, sound } = await synthesizeFn(phrase);
        await this.set(phrase, uri, sound);
        successCount++;

        // Add small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (error) {
        console.warn(`[TTSCache] Failed to cache phrase "${phrase}":`, error);
      }
    }

    console.log(`[TTSCache] ✅ Pre-cached ${successCount}/${CACHE_PHRASES.length} phrases`);
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
          await entry.sound.unloadAsync();
          await FileSystem.deleteAsync(entry.uri, { idempotent: true });
        } catch (e) {
          // Ignore cleanup errors
        }
        this.cache.delete(oldestKey);
        console.log(`[TTSCache] Evicted: "${oldestKey}"`);
      }
    }
  }

  /**
   * Clear all cache
   */
  async clear(): Promise<void> {
    for (const entry of this.cache.values()) {
      try {
        await entry.sound.unloadAsync();
        await FileSystem.deleteAsync(entry.uri, { idempotent: true });
      } catch (e) {
        // Ignore cleanup errors
      }
    }
    this.cache.clear();
    console.log('[TTSCache] Cache cleared');
  }
}

// Global cache instance
const ttsAudioCache = new TTSAudioCache();

export type TTSQueueStatus =
  | 'pending'     // Waiting for synthesis
  | 'synthesizing' // Currently synthesizing
  | 'ready'       // Audio ready to play
  | 'playing'     // Currently playing
  | 'completed'   // Playback completed
  | 'failed';     // Synthesis or playback failed

export interface TTSQueueItem {
  id: string;
  text: string;
  status: TTSQueueStatus;
  audio?: Audio.Sound;
  audioUri?: string;
  error?: string;
  retryCount?: number; // Track retry attempts
}

export interface TTSQueueConfig {
  voiceId?: string;
  userEmotion?: string;
  maxConcurrentSynthesis?: number; // Max parallel TTS requests
  maxRetries?: number; // Max retry attempts for failed synthesis
  retryDelay?: number; // Delay between retries (ms)
  onPlayStart?: (text: string) => void; // Callback when item starts playing
  onPlayEnd?: (text: string) => void; // Callback when item finishes playing
}

/**
 * TTS Queue Manager
 * Handles parallel synthesis and sequential playback
 */
export class TTSQueue {
  private queue: TTSQueueItem[] = [];
  private isPlaying = false;
  private currentIndex = 0;
  private config: TTSQueueConfig;
  private activeSynthesisTasks = 0;
  private onPlaybackComplete?: () => void;
  private isCancelled = false;

  constructor(config: TTSQueueConfig = {}) {
    this.config = {
      maxConcurrentSynthesis: 2, // Reduced to 2 to avoid rate limits
      maxRetries: 3, // Default: max 3 retry attempts
      retryDelay: 1000, // Default: 1s delay between retries
      ...config,
    };
  }

  /**
   * Add sentence to queue and start synthesis
   * @param text Sentence text to synthesize
   */
  async enqueue(text: string): Promise<void> {
    if (this.isCancelled || !text.trim()) return;

    const item: TTSQueueItem = {
      id: `tts_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      text: text.trim(),
      status: 'pending',
    };

    this.queue.push(item);
    console.log(`[TTSQueue] Enqueued sentence ${item.id}: "${text}"`);

    // Start synthesis if capacity allows
    if (this.activeSynthesisTasks < (this.config.maxConcurrentSynthesis || 3)) {
      this.synthesize(item);
    }

    // Start playback if not already playing
    if (!this.isPlaying) {
      this.playNext();
    }
  }

  /**
   * Synthesize audio for queue item with retry logic
   * Phase 3: Added cache support for instant playback
   * @param item Queue item to synthesize
   */
  private async synthesize(item: TTSQueueItem): Promise<void> {
    if (this.isCancelled) return;

    item.status = 'synthesizing';
    item.retryCount = item.retryCount || 0;
    this.activeSynthesisTasks++;

    try {
      // Phase 3: Check cache first
      const cachedSound = await ttsAudioCache.get(item.text);
      if (cachedSound) {
        // Clone the cached sound for independent playback
        const status = await cachedSound.getStatusAsync();
        if (status.isLoaded) {
          const { sound } = await Audio.Sound.createAsync(
            { uri: status.uri || '' },
            { shouldPlay: false }
          );

          item.audio = sound;
          item.audioUri = status.uri || undefined;
          item.status = 'ready';
          this.activeSynthesisTasks--;

          console.log(`[TTSQueue] ⚡ Using cached audio for ${item.id}`);

          // If this is the first item and playback hasn't started, start now
          if (this.queue[0] === item && !this.isPlaying) {
            this.playNext();
          }

          // Start synthesis for next pending item
          const nextPendingIndex = this.queue.findIndex(
            (q) => q.status === 'pending'
          );
          if (nextPendingIndex !== -1) {
            this.synthesize(this.queue[nextPendingIndex]);
          }

          return;
        }
      }

      console.log(`[TTSQueue] Synthesizing ${item.id}... (attempt ${item.retryCount + 1})`);

      // Call ElevenLabs TTS API
      const audioUri = await this.callElevenLabsTTS(item.text);

      // Load audio for playback
      const { sound } = await Audio.Sound.createAsync(
        { uri: audioUri },
        { shouldPlay: false }
      );

      item.audio = sound;
      item.audioUri = audioUri;
      item.status = 'ready';

      console.log(`[TTSQueue] ✅ Synthesis complete for ${item.id}`);

      // Phase 3: Cache the result for future use
      if (item.text.length <= 30) { // Only cache short phrases
        try {
          await ttsAudioCache.set(item.text, audioUri, sound);
        } catch (e) {
          console.warn('[TTSQueue] Failed to cache audio:', e);
        }
      }

      // If this is the first item and playback hasn't started, start now
      if (this.queue[0] === item && !this.isPlaying) {
        this.playNext();
      }

      // Start synthesis for next pending item
      const nextPendingIndex = this.queue.findIndex(
        (q) => q.status === 'pending'
      );
      if (nextPendingIndex !== -1) {
        this.synthesize(this.queue[nextPendingIndex]);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const isRateLimitError = errorMessage.includes('429');

      // Check if we should retry
      const maxRetries = this.config.maxRetries || 3;
      if (item.retryCount < maxRetries && !this.isCancelled) {
        item.retryCount++;
        const retryDelay = this.config.retryDelay || 1000;

        // Increase delay for rate limit errors
        const delay = isRateLimitError ? retryDelay * item.retryCount * 2 : retryDelay * item.retryCount;

        console.warn(
          `[TTSQueue] ⚠️ Synthesis failed for ${item.id} (${errorMessage}). ` +
          `Retrying in ${delay}ms... (${item.retryCount}/${maxRetries})`
        );

        // Reset status to pending for retry
        item.status = 'pending';
        this.activeSynthesisTasks--;

        // Retry after delay
        setTimeout(() => {
          if (!this.isCancelled && item.status === 'pending') {
            this.synthesize(item);
          }
        }, delay);

        return;
      }

      // Max retries reached or cancelled
      console.error(
        `[TTSQueue] ❌ Synthesis failed for ${item.id} after ${item.retryCount} retries: ${errorMessage}`
      );
      item.status = 'failed';
      item.error = errorMessage;
      this.activeSynthesisTasks--;
    }
  }

  /**
   * Call ElevenLabs TTS API
   * @param text Text to synthesize
   * @returns Audio file URI
   */
  private async callElevenLabsTTS(text: string): Promise<string> {
    const apiKey = getElevenLabsApiKey();
    if (!apiKey) {
      throw new Error('ElevenLabs API key not configured');
    }

    const voiceId = this.config.voiceId || getLanLanVoiceId();
    const url = `${ELEVENLABS_CONFIG.baseURL}/text-to-speech/${voiceId}`;
    const voiceSettings = getEmotionalVoiceSettings(this.config.userEmotion);

    // Create temp file path
    const fileName = `tts_queue_${Date.now()}_${Math.random()
      .toString(36)
      .substring(7)}.mp3`;
    const fileUri = FileSystem.documentDirectory + fileName;

    // Preprocess text for natural speech
    const processedText = preprocessTextForNaturalSpeech(text);

    // Use XMLHttpRequest for binary data handling
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', url, true);
      xhr.responseType = 'blob';

      xhr.setRequestHeader('Accept', 'audio/mpeg');
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.setRequestHeader('xi-api-key', apiKey);

      xhr.onload = async () => {
        if (xhr.status === 200) {
          try {
            // Convert blob to base64 and save
            const reader = new FileReader();
            reader.onloadend = async () => {
              const base64data = reader.result as string;
              const base64Audio = base64data.split(',')[1];

              await FileSystem.writeAsStringAsync(fileUri, base64Audio, {
                encoding: FileSystem.EncodingType.Base64,
              });

              resolve(fileUri);
            };
            reader.readAsDataURL(xhr.response);
          } catch (error) {
            reject(new Error(`Failed to save audio file: ${error}`));
          }
        } else {
          reject(new Error(`ElevenLabs API error: ${xhr.status}`));
        }
      };

      xhr.onerror = () => {
        reject(new Error('Network request failed'));
      };

      xhr.send(
        JSON.stringify({
          text: processedText,
          model_id: ELEVENLABS_CONFIG.defaultModel,
          voice_settings: voiceSettings,
        })
      );
    });
  }

  /**
   * Play next item in queue
   * Waits for synthesis if needed
   */
  private async playNext(): Promise<void> {
    if (this.isCancelled) {
      this.isPlaying = false;
      return;
    }

    // Check if we've reached the end
    if (this.currentIndex >= this.queue.length) {
      this.isPlaying = false;
      console.log('[TTSQueue] ✅ All items played');

      // Call completion callback
      if (this.onPlaybackComplete) {
        this.onPlaybackComplete();
      }
      return;
    }

    const item = this.queue[this.currentIndex];
    this.isPlaying = true;

    // Wait for synthesis to complete
    while (
      item.status !== 'ready' &&
      item.status !== 'failed' &&
      item.status !== 'completed' &&
      !this.isCancelled
    ) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    // Skip failed items
    if (item.status === 'failed' || item.status === 'completed') {
      console.log(`[TTSQueue] Skipping ${item.status} item ${item.id}`);
      this.currentIndex++;
      this.playNext();
      return;
    }

    // Play audio
    if (item.audio && !this.isCancelled) {
      try {
        console.log(`[TTSQueue] 🔊 Playing ${item.id}: "${item.text}"`);
        item.status = 'playing';

        // Callback: Playback started
        if (this.config.onPlayStart) {
          this.config.onPlayStart(item.text);
        }

        // Set playback completion callback
        item.audio.setOnPlaybackStatusUpdate((status) => {
          if (status.isLoaded && status.didJustFinish) {
            item.status = 'completed';

            // Callback: Playback ended
            if (this.config.onPlayEnd) {
              this.config.onPlayEnd(item.text);
            }

            this.currentIndex++;

            // Cleanup audio
            item.audio?.unloadAsync();
            if (item.audioUri) {
              FileSystem.deleteAsync(item.audioUri, { idempotent: true });
            }

            // Play next
            if (!this.isCancelled) {
              this.playNext();
            }
          }
        });

        await item.audio.playAsync();
      } catch (error) {
        console.error(`[TTSQueue] ❌ Playback error for ${item.id}:`, error);
        item.status = 'failed';
        this.currentIndex++;
        this.playNext();
      }
    }
  }

  /**
   * Wait for all items to complete playback
   * Used in useChatAI to ensure conversation finishes
   */
  async waitForCompletion(): Promise<void> {
    return new Promise((resolve) => {
      // If already completed, resolve immediately
      if (!this.isPlaying && this.currentIndex >= this.queue.length) {
        resolve();
        return;
      }

      // Otherwise wait for completion callback
      this.onPlaybackComplete = () => {
        resolve();
      };
    });
  }

  /**
   * Cancel all pending and playing items
   * Used when user stops playback
   */
  async cancel(): Promise<void> {
    console.log('[TTSQueue] Cancelling all items...');
    this.isCancelled = true;
    this.isPlaying = false;

    // Stop current playback
    const currentItem = this.queue[this.currentIndex];
    if (currentItem?.audio) {
      try {
        await currentItem.audio.stopAsync();
        await currentItem.audio.unloadAsync();
      } catch (e) {
        // Ignore errors during cleanup
      }
    }

    // Cleanup all audio resources
    for (const item of this.queue) {
      if (item.audio) {
        try {
          await item.audio.unloadAsync();
        } catch (e) {
          // Ignore
        }
      }
      if (item.audioUri) {
        FileSystem.deleteAsync(item.audioUri, { idempotent: true });
      }
    }

    this.queue = [];
    this.currentIndex = 0;
    this.activeSynthesisTasks = 0;
  }

  /**
   * Get current queue status (for debugging)
   */
  getStatus(): {
    total: number;
    pending: number;
    synthesizing: number;
    ready: number;
    playing: number;
    completed: number;
    failed: number;
  } {
    return {
      total: this.queue.length,
      pending: this.queue.filter((i) => i.status === 'pending').length,
      synthesizing: this.queue.filter((i) => i.status === 'synthesizing')
        .length,
      ready: this.queue.filter((i) => i.status === 'ready').length,
      playing: this.queue.filter((i) => i.status === 'playing').length,
      completed: this.queue.filter((i) => i.status === 'completed').length,
      failed: this.queue.filter((i) => i.status === 'failed').length,
    };
  }
}

/**
 * Initialize TTS cache system
 * Phase 3: Call this during app startup to prepare cache
 */
export async function initializeTTSCache(): Promise<void> {
  await ttsAudioCache.initialize();
  console.log('[TTSQueue] Cache system initialized');
}

/**
 * Pre-cache common phrases for instant playback
 * Phase 3: Optional - can be called after app startup to warm up cache
 *
 * Note: This function is CPU and network intensive. It's recommended to:
 * 1. Call it in background after app startup
 * 2. Or skip it and let cache build naturally during use
 */
export async function preCacheCommonPhrases(): Promise<void> {
  // Synthesis function for cache pre-generation
  const synthesizeForCache = async (text: string): Promise<{ uri: string; sound: Audio.Sound }> => {
    const apiKey = getElevenLabsApiKey();
    if (!apiKey) {
      throw new Error('ElevenLabs API key not configured');
    }

    const voiceId = getLanLanVoiceId();
    const url = `${ELEVENLABS_CONFIG.baseURL}/text-to-speech/${voiceId}`;
    const voiceSettings = getEmotionalVoiceSettings();

    // Create cache file path
    const fileName = `tts_cache_${Date.now()}_${Math.random().toString(36).substring(7)}.mp3`;
    const fileUri = (FileSystem.documentDirectory + 'tts_cache/') + fileName;

    // Preprocess text
    const processedText = preprocessTextForNaturalSpeech(text);

    // Synthesize using XMLHttpRequest
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', url, true);
      xhr.responseType = 'blob';

      xhr.setRequestHeader('Accept', 'audio/mpeg');
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.setRequestHeader('xi-api-key', apiKey);

      xhr.onload = async () => {
        if (xhr.status === 200) {
          try {
            const reader = new FileReader();
            reader.onloadend = async () => {
              const base64data = reader.result as string;
              const base64Audio = base64data.split(',')[1];

              await FileSystem.writeAsStringAsync(fileUri, base64Audio, {
                encoding: FileSystem.EncodingType.Base64,
              });

              const { sound } = await Audio.Sound.createAsync(
                { uri: fileUri },
                { shouldPlay: false }
              );

              resolve({ uri: fileUri, sound });
            };
            reader.readAsDataURL(xhr.response);
          } catch (error) {
            reject(new Error(`Failed to save cache audio: ${error}`));
          }
        } else {
          reject(new Error(`ElevenLabs API error: ${xhr.status}`));
        }
      };

      xhr.onerror = () => {
        reject(new Error('Network request failed during cache pre-generation'));
      };

      xhr.send(
        JSON.stringify({
          text: processedText,
          model_id: ELEVENLABS_CONFIG.defaultModel,
          voice_settings: voiceSettings,
        })
      );
    });
  };

  // Use the cache's pre-generation method
  await ttsAudioCache.preCacheCommonPhrases(synthesizeForCache);
}

/**
 * Clear TTS cache
 * Useful for troubleshooting or memory management
 */
export async function clearTTSCache(): Promise<void> {
  await ttsAudioCache.clear();
}
