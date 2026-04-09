// src/capabilities/speak/queue/TTSQueue.ts

import {
  ITTSQueue,
  TTSQueueConfig,
  TTSQueueItem,
  TTSQueueStatus as TTSQueueStatusInfo,
  TTSSynthesisOptions,
} from '../../../types/speak';
import { FishAudioProvider } from '../providers/FishAudioProvider';
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
  private provider: FishAudioProvider;
  private cache: AudioCache;

  constructor(
    config: TTSQueueConfig = {},
    provider?: FishAudioProvider,
    cache?: AudioCache
  ) {
    this.config = {
      maxConcurrentSynthesis: 2, // Reduced to 2 to avoid rate limits
      maxRetries: 3, // Default: max 3 retry attempts
      retryDelay: 1000, // Default: 1s delay between retries
      ...config,
    };
    this.provider = provider || new FishAudioProvider();
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
      options, // Store options with the item for later use
    };

    this.queue.push(item);
    console.log(`[TTSQueue] Enqueued sentence ${item.id}: "${text}"`);

    // Start synthesis if capacity allows
    if (this.activeSynthesisTasks < (this.config.maxConcurrentSynthesis || 2)) {
      console.log(`[TTSQueue] 🚀 Starting synthesis for ${item.id} (active tasks: ${this.activeSynthesisTasks})`);
      this.synthesize(item, options);
    } else {
      console.log(`[TTSQueue] ⏳ Queued ${item.id} - waiting for available slot (active tasks: ${this.activeSynthesisTasks})`);
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

        console.log(`[TTSQueue] ⚡ Using cached audio for ${item.id} (active tasks: ${this.activeSynthesisTasks})`);

        // If this is the first item and playback hasn't started, start now
        if (this.queue[0] === item && !this.isPlaying) {
          this.playNext();
        }

        // Start synthesis for next pending item
        console.log(`[TTSQueue] 🔄 Checking for next pending item after cache hit...`);
        this.synthesizeNextPending(options);
        return;
      }

      console.log(`[TTSQueue] Synthesizing ${item.id}... (attempt ${item.retryCount + 1})`);

      // Use ElevenLabsProvider to synthesize
      const result = await this.provider.synthesize(item.text, options);

      item.audioUri = result.audioUri;
      item.status = 'ready';

      console.log(`[TTSQueue] ✅ Synthesis complete for ${item.id} (active tasks: ${this.activeSynthesisTasks - 1})`);

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

      // Decrement active tasks BEFORE checking for next pending
      this.activeSynthesisTasks--;

      // Start synthesis for next pending item
      console.log(`[TTSQueue] 🔄 Checking for next pending item after synthesis...`);
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
   * FIX: Use options stored in the item, not passed parameter
   */
  private synthesizeNextPending(options?: TTSSynthesisOptions): void {
    const nextPendingIndex = this.queue.findIndex(
      (q) => q.status === 'pending'
    );

    if (nextPendingIndex !== -1) {
      const nextItem = this.queue[nextPendingIndex];
      const itemOptions = nextItem.options || options; // Prefer item's stored options

      if (this.activeSynthesisTasks < (this.config.maxConcurrentSynthesis || 2)) {
        console.log(`[TTSQueue] 🚀 Starting next pending synthesis: ${nextItem.id} (active tasks: ${this.activeSynthesisTasks})`);
        this.synthesize(nextItem, itemOptions);
      } else {
        console.log(`[TTSQueue] ⏸️ Cannot start ${nextItem.id} - max concurrent reached (active: ${this.activeSynthesisTasks})`);
      }
    } else {
      console.log(`[TTSQueue] ℹ️ No pending items to synthesize (active tasks: ${this.activeSynthesisTasks})`);
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

        // Callback: Playback started
        if (this.config.onItemStart) {
          this.config.onItemStart(item);
        }

        // Play using provider (provider handles audio mode setup)
        await this.provider.play(item.audioUri, {
          onStart: () => {
            console.log(`[TTSQueue] ▶️ Started playing ${item.id}`);
          },
          onEnd: async () => {
            // Check if cancelled during playback
            if (this.isCancelled) {
              console.log(`[TTSQueue] ⚠️ Playback completed but queue is cancelled, skipping cleanup`);
              return;
            }

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

    // Stop current playback immediately
    await this.provider.stop();

    // CRITICAL FIX: Mark all items as cancelled to prevent playNext from processing them
    for (const item of this.queue) {
      if (item.status === 'playing' || item.status === 'ready') {
        item.status = 'failed'; // Mark as failed to skip in playNext
      }
    }

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

    // Clear queue and reset state
    this.queue = [];
    this.currentIndex = 0;
    this.activeSynthesisTasks = 0;

    // Resolve any pending waitForCompletion promises
    if (this.onPlaybackComplete) {
      this.onPlaybackComplete();
      this.onPlaybackComplete = undefined;
    }
  }

  /**
   * Get current queue status (for debugging)
   */
  getStatus(): TTSQueueStatusInfo {
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
   * IMPORTANT: Call this before reusing a TTSQueue instance
   */
  reset(): void {
    console.log('[TTSQueue] Resetting cancelled state');
    this.isCancelled = false;
    this.queue = [];
    this.currentIndex = 0;
    this.activeSynthesisTasks = 0;
    this.isPlaying = false;
    this.onPlaybackComplete = undefined;
  }
}
