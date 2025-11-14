// src/types/speak/provider.ts

import { TTSSynthesisOptions, TTSSynthesisResult } from './common';

/**
 * Base TTS Provider interface
 * All TTS providers must implement this interface
 */
export interface TTSProvider {
  /**
   * Provider name
   */
  readonly name: string;

  /**
   * Check if provider is available
   */
  isAvailable(): Promise<boolean>;

  /**
   * Synthesize speech from text
   * @param text Text to synthesize
   * @param options Synthesis options
   * @returns Audio file URI and metadata
   */
  synthesize(text: string, options?: TTSSynthesisOptions): Promise<TTSSynthesisResult>;

  /**
   * Play audio file
   * @param audioUri Audio file URI
   * @param callbacks Playback callbacks
   */
  play(
    audioUri: string,
    callbacks?: {
      onStart?: () => void;
      onEnd?: () => void;
      onError?: (error: Error) => void;
    }
  ): Promise<void>;

  /**
   * Stop current playback
   */
  stop(): Promise<void>;

  /**
   * Cleanup resources
   */
  cleanup(): Promise<void>;
}

/**
 * Provider factory type
 */
export type TTSProviderFactory = () => TTSProvider;
