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
   * @param item Queue item to synthesize
   */
  private async synthesize(item: TTSQueueItem): Promise<void> {
    if (this.isCancelled) return;

    item.status = 'synthesizing';
    item.retryCount = item.retryCount || 0;
    this.activeSynthesisTasks++;

    try {
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

        // Set playback completion callback
        item.audio.setOnPlaybackStatusUpdate((status) => {
          if (status.isLoaded && status.didJustFinish) {
            item.status = 'completed';
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
