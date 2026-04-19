// src/capabilities/speak/providers/FishAudioProvider.ts

import { File } from 'expo-file-system';
import {
  TTSProvider,
  TTSSynthesisOptions,
  TTSSynthesisResult,
} from '../../../types/speak';
import { synthesizeWithFishAudio } from '../fishAudioAPI';
import { getFishAudioApiKey } from '../../../constants/ai';
import { audioModeManager } from '../../../utils/audioModeManager';
import { amplifiedAudioBridge, AUDIO_GAIN } from './amplifiedAudioBridge';
import { lipSyncBridge } from '../lipSyncBridge';

/**
 * Fish Audio TTS Provider
 * Implements TTSProvider interface using Fish Audio s2-pro model.
 * Audio playback is routed through a hidden WebView with Web Audio API GainNode
 * to achieve volume amplification beyond the system maximum (AUDIO_GAIN = 3.0 = 300%).
 */
export class FishAudioProvider implements TTSProvider {
  readonly name = 'fishaudio';
  private isCancelled = false;

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
    this.isCancelled = false;

    try {
      // Ensure audio routes through speaker, not earpiece
      await audioModeManager.setPlaybackMode();

      if (this.isCancelled) return;

      // Read the local audio file as base64
      const base64 = await new File(audioUri).base64();

      if (this.isCancelled) return;

      console.log('[FishAudioProvider] 🔊 Sending to WebView audio player (gain:', AUDIO_GAIN, ')');

      // Play via WebView GainNode — resolves when playback ends
      await new Promise<void>((resolve, reject) => {
        amplifiedAudioBridge.play(base64, AUDIO_GAIN, {
          onStart: () => {
            console.log('[FishAudioProvider] ▶️ Playback started');
            callbacks?.onStart?.();
            lipSyncBridge.sendVRMCommand({ type: 'lipSyncStart' });
          },
          onEnd: () => {
            console.log('[FishAudioProvider] ✅ Playback finished');
            callbacks?.onEnd?.();
            resolve();
          },
          onError: (error) => {
            console.error('[FishAudioProvider] ❌ Playback error:', error);
            callbacks?.onError?.(error);
            reject(error);
          },
        });
      });
    } catch (error) {
      if (this.isCancelled) return;
      console.error('[FishAudioProvider] ❌ Play error:', error);
      const err = error instanceof Error ? error : new Error(String(error));
      callbacks?.onError?.(err);
      throw err;
    }
  }

  async stop(): Promise<void> {
    console.log('[FishAudioProvider] 🛑 Stopping playback');
    this.isCancelled = true;
    amplifiedAudioBridge.stop();
  }

  async cleanup(): Promise<void> {
    console.log('[FishAudioProvider] 🧹 Cleanup');
    this.isCancelled = true;
    amplifiedAudioBridge.stop();
  }
}
