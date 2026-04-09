// src/capabilities/speak/providers/FishAudioProvider.ts

import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import {
  TTSProvider,
  TTSSynthesisOptions,
  TTSSynthesisResult,
} from '../../../types/speak';
import { synthesizeWithFishAudio } from '../fishAudioAPI';
import { getFishAudioApiKey } from '../../../constants/ai';
import { audioModeManager } from '../../../utils/audioModeManager';

/**
 * Fish Audio TTS Provider
 * Implements TTSProvider interface using Fish Audio s2-pro model
 */
export class FishAudioProvider implements TTSProvider {
  readonly name = 'fishaudio';
  private currentPlayer: AudioPlayer | null = null;
  private currentSubscription: { remove: () => void } | null = null;
  private isCurrentlyPlaying = false;

  async isAvailable(): Promise<boolean> {
    const apiKey = getFishAudioApiKey();
    return !!apiKey;
  }

  async synthesize(
    text: string,
    options?: TTSSynthesisOptions
  ): Promise<TTSSynthesisResult> {
    return synthesizeWithFishAudio(text, options);
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
      this.cleanupCurrentPlayer();

      // Set audio mode to playback for louder speaker output
      await audioModeManager.setPlaybackMode();

      this.currentPlayer = createAudioPlayer({ uri: audioUri });
      this.currentPlayer.volume = 1.0;

      console.log('[FishAudioProvider] 🔊 Created audio player for:', audioUri);

      this.currentSubscription = this.currentPlayer.addListener(
        'playbackStatusUpdate',
        (status) => {
          if (status.playing && !this.isCurrentlyPlaying) {
            this.isCurrentlyPlaying = true;
            console.log('[FishAudioProvider] ▶️ Playback started');
            callbacks?.onStart?.();
          }
          if (status.didJustFinish) {
            console.log('[FishAudioProvider] ✅ Playback finished');
            this.isCurrentlyPlaying = false;
            this.cleanupCurrentPlayer();
            callbacks?.onEnd?.();
          }
        }
      );

      this.currentPlayer.play();
      console.log('[FishAudioProvider] 🎵 Started playback');
    } catch (error) {
      this.isCurrentlyPlaying = false;
      console.error('[FishAudioProvider] ❌ Play error:', error);
      this.cleanupCurrentPlayer();
      const err = error instanceof Error ? error : new Error(String(error));
      callbacks?.onError?.(err);
      throw err;
    }
  }

  async stop(): Promise<void> {
    console.log('[FishAudioProvider] 🛑 Stopping playback');
    if (this.currentPlayer) {
      try {
        this.currentPlayer.pause();
      } catch (e) {
        console.warn('[FishAudioProvider] ⚠️ Error pausing player:', e);
      }
    }
    this.isCurrentlyPlaying = false;
    this.cleanupCurrentPlayer();
  }

  async cleanup(): Promise<void> {
    console.log('[FishAudioProvider] 🧹 Cleanup');
    this.isCurrentlyPlaying = false;
    this.cleanupCurrentPlayer();
  }

  private cleanupCurrentPlayer(): void {
    if (this.currentSubscription) {
      try {
        this.currentSubscription.remove();
      } catch (e) {
        console.warn('[FishAudioProvider] ⚠️ Error removing subscription:', e);
      }
      this.currentSubscription = null;
    }
    if (this.currentPlayer) {
      try {
        this.currentPlayer.remove();
      } catch (e) {
        console.warn('[FishAudioProvider] ⚠️ Error removing player:', e);
      }
      this.currentPlayer = null;
    }
  }
}
