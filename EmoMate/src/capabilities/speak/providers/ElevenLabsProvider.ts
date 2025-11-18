// src/capabilities/speak/providers/ElevenLabsProvider.ts

import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import {
  TTSProvider,
  TTSSynthesisOptions,
  TTSSynthesisResult,
} from '../../../types/speak';
import { synthesizeWithElevenLabs } from '../elevenLabsAPI';
import { getElevenLabsApiKey } from '../../../constants/ai';
import { audioModeManager } from '../../../utils/audioModeManager';

/**
 * ElevenLabs TTS Provider
 * Implements TTSProvider interface for ElevenLabs service
 * Uses expo-audio for reliable playback control
 */
export class ElevenLabsProvider implements TTSProvider {
  readonly name = 'elevenlabs';
  private currentPlayer: AudioPlayer | null = null;
  private currentSubscription: { remove: () => void } | null = null;
  private isCurrentlyPlaying = false;

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
      // Cleanup previous player if exists
      this.cleanupCurrentPlayer();

      // CRITICAL: Set audio mode to PLAYBACK for louder speaker output
      // This sets allowsRecording: false and shouldRouteThroughEarpiece: false
      await audioModeManager.setPlaybackMode();

      // Create new audio player
      this.currentPlayer = createAudioPlayer({ uri: audioUri });

      // Set volume to maximum
      this.currentPlayer.volume = 1.0;

      console.log(
        '[ElevenLabsProvider] 🔊 Created audio player for:',
        audioUri
      );

      // Set playback status listener
      this.currentSubscription = this.currentPlayer.addListener(
        'playbackStatusUpdate',
        (status) => {
          if (status.playing && !this.isCurrentlyPlaying) {
            this.isCurrentlyPlaying = true;
            console.log('[ElevenLabsProvider] ▶️ Playback started');
            callbacks?.onStart?.();
          }

          if (status.didJustFinish) {
            console.log('[ElevenLabsProvider] ✅ Playback finished');
            this.isCurrentlyPlaying = false;

            // Cleanup before calling callback
            this.cleanupCurrentPlayer();

            callbacks?.onEnd?.();
          }
        }
      );

      // Start playback
      this.currentPlayer.play();
      console.log('[ElevenLabsProvider] 🎵 Started playback');
    } catch (error) {
      this.isCurrentlyPlaying = false;
      console.error('[ElevenLabsProvider] ❌ Play error:', error);

      // Cleanup on error
      this.cleanupCurrentPlayer();

      const err = error instanceof Error ? error : new Error(String(error));
      callbacks?.onError?.(err);
      throw err;
    }
  }

  async stop(): Promise<void> {
    console.log('[ElevenLabsProvider] 🛑 Stopping playback');

    if (this.currentPlayer) {
      try {
        this.currentPlayer.pause();
      } catch (e) {
        console.warn('[ElevenLabsProvider] ⚠️ Error pausing player:', e);
      }
    }

    this.isCurrentlyPlaying = false;
    this.cleanupCurrentPlayer();
  }

  async cleanup(): Promise<void> {
    console.log('[ElevenLabsProvider] 🧹 Cleanup');
    this.isCurrentlyPlaying = false;
    this.cleanupCurrentPlayer();
  }

  /**
   * Cleanup current player and subscription
   */
  private cleanupCurrentPlayer(): void {
    // Remove event listener
    if (this.currentSubscription) {
      try {
        this.currentSubscription.remove();
      } catch (e) {
        console.warn('[ElevenLabsProvider] ⚠️ Error removing subscription:', e);
      }
      this.currentSubscription = null;
    }

    // Remove player
    if (this.currentPlayer) {
      try {
        this.currentPlayer.remove();
      } catch (e) {
        console.warn('[ElevenLabsProvider] ⚠️ Error removing player:', e);
      }
      this.currentPlayer = null;
    }
  }
}
