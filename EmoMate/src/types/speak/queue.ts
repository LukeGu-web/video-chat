// src/types/speak/queue.ts

import { TTSQueueItem, TTSSynthesisOptions } from './common';

/**
 * TTS Queue configuration
 */
export interface TTSQueueConfig {
  maxConcurrentSynthesis?: number;
  maxRetries?: number;
  retryDelay?: number;
  onItemStart?: (item: TTSQueueItem) => void;
  onItemEnd?: (item: TTSQueueItem) => void;
  onItemError?: (item: TTSQueueItem, error: Error) => void;
}

/**
 * TTS Queue status
 */
export interface TTSQueueStatus {
  total: number;
  pending: number;
  synthesizing: number;
  ready: number;
  playing: number;
  completed: number;
  failed: number;
}

/**
 * TTS Queue interface
 */
export interface ITTSQueue {
  /**
   * Enqueue text for synthesis and playback
   * @param text Text to speak
   * @param options Synthesis options
   */
  enqueue(text: string, options?: TTSSynthesisOptions): Promise<void>;

  /**
   * Cancel all pending items
   */
  cancel(): Promise<void>;

  /**
   * Wait for all items to complete
   */
  waitForCompletion(): Promise<void>;

  /**
   * Get current queue status
   */
  getStatus(): TTSQueueStatus;
}
