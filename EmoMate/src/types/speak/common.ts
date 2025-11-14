// src/types/speak/common.ts

/**
 * TTS Provider type
 */
export type TTSProviderType = 'expo' | 'elevenlabs';

/**
 * TTS playback mode
 */
export type TTSMode = 'simple' | 'streaming';

/**
 * TTS queue item status
 */
export type TTSQueueStatus =
  | 'pending'       // Waiting for synthesis
  | 'synthesizing'  // Currently synthesizing
  | 'ready'         // Ready to play
  | 'playing'       // Currently playing
  | 'completed'     // Playback completed
  | 'failed';       // Synthesis or playback failed

/**
 * TTS queue item
 */
export interface TTSQueueItem {
  id: string;
  text: string;
  status: TTSQueueStatus;
  audioUri?: string;
  error?: string;
  retryCount?: number;
}

/**
 * TTS synthesis options
 */
export interface TTSSynthesisOptions {
  voiceId?: string;
  emotion?: string;
  language?: string;
  pitch?: number;
  rate?: number;
}

/**
 * TTS synthesis result
 */
export interface TTSSynthesisResult {
  audioUri: string;
  duration?: number;
}

/**
 * Audio cache entry
 */
export interface AudioCacheEntry {
  uri: string;
  text: string;
  lastAccessed: number;
  size: number;
}

/**
 * TTS configuration
 */
export interface TTSConfig {
  provider: TTSProviderType;
  mode: TTSMode;
  maxConcurrentSynthesis?: number;
  maxRetries?: number;
  retryDelay?: number;
  enableCache?: boolean;
  fallbackToExpo?: boolean;
}
