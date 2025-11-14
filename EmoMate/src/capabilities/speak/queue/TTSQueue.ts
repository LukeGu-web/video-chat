// src/capabilities/speak/queue/TTSQueue.ts

import Sound from 'react-native-sound';
import { setAudioModeAsync } from 'expo-audio';
import {
  ITTSQueue,
  TTSQueueConfig,
  TTSQueueItem,
  TTSQueueStatus,
  TTSSynthesisOptions,
} from '../../../types/speak';
import { ElevenLabsProvider } from '../providers/ElevenLabsProvider';
import { AudioCache } from '../cache/AudioCache';
import { safeDeleteFile } from '../../../utils/fileSystemHelpers';

/**
 * TTS Queue Manager
 * Handles parallel synthesis and sequential playback
 */
export class TTSQueue implements ITTSQueue {
  private queue: TTSQueueItem[] = [];
  private isPlaying = false;
  private currentIndex = 0;
  private config: TTSQueueConfig;
  private activeSynthesisTasks = 0;
  private onPlaybackComplete?: () => void;
  private isCancelled = false;
  private provider: ElevenLabsProvider;
  private cache: AudioCache;

  constructor(
    config: TTSQueueConfig = {},
    provider?: ElevenLabsProvider,
    cache?: AudioCache
  ) {
    this.config = {
      maxConcurrentSynthesis: 2, // Reduced to 2 to avoid rate limits
      maxRetries: 3, // Default: max 3 retry attempts
      retryDelay: 1000, // Default: 1s delay between retries
      ...config,
    };
    this.provider = provider || new ElevenLabsProvider();
    this.cache = cache || new AudioCache();
  }

  /**
   * Add sentence to queue and start synthesis
   * @param text Sentence text to synthesize
   * @param options Synthesis options
   */
  async enqueue(text: string, options?: TTSSynthesisOptions): Promise<void> {
    if (this.isCancelled || !text.trim()) return;

    const item: TTSQueueItem = {
      id: `tts_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      text: text.trim(),
      status: 'pending',
    };

    this.queue.push(item);
    console.log(`[TTSQueue] Enqueued sentence ${item.id}: "${text}"`);

    // Start synthesis if capacity allows
    if (this.activeSynthesisTasks < (this.config.maxConcurrentSynthesis || 2)) {
      this.synthesize(item, options);
    }

    // Start playback if not already playing
    if (!this.isPlaying) {
      this.playNext();
    }
  }

  /**
   * Synthesize audio for queue item with retry logic
   * @param item Queue item to synthesize
   * @param options Synthesis options
   */
  private async synthesize(item: TTSQueueItem, options?: TTSSynthesisOptions): Promise<void> {
    if (this.isCancelled) return;

    item.status = 'synthesizing';
    item.retryCount = item.retryCount || 0;
    this.activeSynthesisTasks++;

    try {
      // Check cache first
      const cachedEntry = await this.cache.get(item.text);
      if (cachedEntry) {
        item.audioUri = cachedEntry.uri;
        item.status = 'ready';
        this.activeSynthesisTasks--;

        console.log(`[TTSQueue] ⚡ Using cached audio for ${item.id}`);

        // If this is the first item and playback hasn't started, start now
        if (this.queue[0] === item && !this.isPlaying) {
          this.playNext();
        }

        // Start synthesis for next pending item
        this.synthesizeNextPending(options);
        return;
      }

      console.log(`[TTSQueue] Synthesizing ${item.id}... (attempt ${item.retryCount + 1})`);

      // Use ElevenLabsProvider to synthesize
      const result = await this.provider.synthesize(item.text, options);

      item.audioUri = result.audioUri;
      item.status = 'ready';

      console.log(`[TTSQueue] ✅ Synthesis complete for ${item.id}`);

      // Cache the result for future use (only cache short phrases)
      if (item.text.length <= 30) {
        try {
          await this.cache.set(item.text, result.audioUri);
        } catch (e) {
          console.warn('[TTSQueue] Failed to cache audio:', e);
        }
      }

      // If this is the first item and playback hasn't started, start now
      if (this.queue[0] === item && !this.isPlaying) {
        this.playNext();
      }

      // Start synthesis for next pending item
      this.synthesizeNextPending(options);
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
            this.synthesize(item, options);
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

      // Notify error callback
      if (this.config.onItemError) {
        this.config.onItemError(item, error instanceof Error ? error : new Error(errorMessage));
      }
    }
  }

  /**
   * Start synthesis for next pending item
   */
  private synthesizeNextPending(options?: TTSSynthesisOptions): void {
    const nextPendingIndex = this.queue.findIndex(
      (q) => q.status === 'pending'
    );
    if (nextPendingIndex !== -1 && this.activeSynthesisTasks < (this.config.maxConcurrentSynthesis || 2)) {
      this.synthesize(this.queue[nextPendingIndex], options);
    }
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
    if (item.audioUri && !this.isCancelled) {
      try {
        console.log(`[TTSQueue] 🔊 Playing ${item.id}: "${item.text}"`);
        item.status = 'playing';

        // Force react-native-sound to use speaker (this overrides expo-audio)
        try {
          Sound.setCategory('Playback', true); // true = force speaker output
          console.log('[TTSQueue] ✅ react-native-sound category set to Playback (speaker)');
        } catch (error) {
          console.warn('[TTSQueue] ⚠️ Failed to set Sound category:', error);
        }

        // Set expo-audio mode to maximize volume output
        try {
          await setAudioModeAsync({
            playsInSilentMode: true,
            allowsRecording: false, // CRITICAL: Disable recording for louder output
            shouldPlayInBackground: true,
            interruptionMode: 'duckOthers',
            interruptionModeAndroid: 'duckOthers',
            shouldRouteThroughEarpiece: false, // CRITICAL: Use speaker, not earpiece
          });
          console.log('[TTSQueue] ✅ expo-audio mode set: allowsRecording=false, speaker output');
        } catch (error) {
          console.warn('[TTSQueue] ⚠️ Failed to set audio mode:', error);
        }

        // Callback: Playback started
        if (this.config.onItemStart) {
          this.config.onItemStart(item);
        }

        // Play using provider
        await this.provider.play(item.audioUri, {
          onStart: () => {
            console.log(`[TTSQueue] ▶️ Started playing ${item.id}`);
          },
          onEnd: async () => {
            item.status = 'completed';

            // Callback: Playback ended
            if (this.config.onItemEnd) {
              this.config.onItemEnd(item);
            }

            this.currentIndex++;

            // Cleanup audio file (only if not cached)
            const isCached = await this.cache.get(item.text);
            if (!isCached && item.audioUri) {
              await safeDeleteFile(item.audioUri);
            }

            // Play next
            if (!this.isCancelled) {
              this.playNext();
            }
          },
          onError: (error) => {
            console.error(`[TTSQueue] ❌ Playback error for ${item.id}:`, error);
            item.status = 'failed';
            item.error = error.message;

            if (this.config.onItemError) {
              this.config.onItemError(item, error);
            }

            this.currentIndex++;
            this.playNext();
          },
        });
      } catch (error) {
        console.error(`[TTSQueue] ❌ Playback error for ${item.id}:`, error);
        item.status = 'failed';
        item.error = error instanceof Error ? error.message : 'Unknown error';

        if (this.config.onItemError) {
          this.config.onItemError(item, error instanceof Error ? error : new Error(String(error)));
        }

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
    await this.provider.stop();

    // Cleanup all audio resources
    for (const item of this.queue) {
      if (item.audioUri) {
        // Only delete if not cached
        const isCached = await this.cache.get(item.text);
        if (!isCached) {
          await safeDeleteFile(item.audioUri);
        }
      }
    }

    this.queue = [];
    this.currentIndex = 0;
    this.activeSynthesisTasks = 0;
  }

  /**
   * Get current queue status (for debugging)
   */
  getStatus(): TTSQueueStatus {
    return {
      total: this.queue.length,
      pending: this.queue.filter((i) => i.status === 'pending').length,
      synthesizing: this.queue.filter((i) => i.status === 'synthesizing').length,
      ready: this.queue.filter((i) => i.status === 'ready').length,
      playing: this.queue.filter((i) => i.status === 'playing').length,
      completed: this.queue.filter((i) => i.status === 'completed').length,
      failed: this.queue.filter((i) => i.status === 'failed').length,
    };
  }

  /**
   * Reset cancelled state for reuse
   */
  reset(): void {
    this.isCancelled = false;
  }
}
