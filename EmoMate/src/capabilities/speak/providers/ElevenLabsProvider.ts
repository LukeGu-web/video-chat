// src/capabilities/speak/providers/ElevenLabsProvider.ts

import { TTSProvider, TTSSynthesisOptions, TTSSynthesisResult } from '../../../types/speak';
import { synthesizeWithElevenLabs } from '../core/elevenLabsAPI';
import { getElevenLabsApiKey } from '../../../constants/ai';
import { SoundPlayer } from '../soundPlayer';
import { audioModeManager } from '../../../utils/audioModeManager';

/**
 * ElevenLabs TTS Provider
 * Implements TTSProvider interface for ElevenLabs service
 */
export class ElevenLabsProvider implements TTSProvider {
  readonly name = 'elevenlabs';
  private soundPlayer: SoundPlayer;
  private isCurrentlyPlaying = false;

  constructor() {
    this.soundPlayer = new SoundPlayer();
  }

  async isAvailable(): Promise<boolean> {
    const apiKey = getElevenLabsApiKey();
    return !!apiKey;
  }

  async synthesize(
    text: string,
    options?: TTSSynthesisOptions
  ): Promise<TTSSynthesisResult> {
    return synthesizeWithElevenLabs(text, options);
  }

  async play(
    audioUri: string,
    callbacks?: {
      onStart?: () => void;
      onEnd?: () => void;
      onError?: (error: Error) => void;
    }
  ): Promise<void> {
    try {
      // Set audio mode before playback
      await audioModeManager.setIdleMode();

      // Play using SoundPlayer
      await this.soundPlayer.play(audioUri, {
        onPlaybackStatusUpdate: (status) => {
          if (status.playing && !this.isCurrentlyPlaying) {
            this.isCurrentlyPlaying = true;
            callbacks?.onStart?.();
          }
        },
        onPlaybackFinished: () => {
          this.isCurrentlyPlaying = false;
          callbacks?.onEnd?.();
        },
        onError: (error) => {
          this.isCurrentlyPlaying = false;
          callbacks?.onError?.(error);
        },
      });
    } catch (error) {
      this.isCurrentlyPlaying = false;
      const err = error instanceof Error ? error : new Error(String(error));
      callbacks?.onError?.(err);
      throw err;
    }
  }

  async stop(): Promise<void> {
    this.soundPlayer.stop();
    this.isCurrentlyPlaying = false;
  }

  async cleanup(): Promise<void> {
    this.soundPlayer.release();
    this.isCurrentlyPlaying = false;
  }
}
