// src/capabilities/speak/providers/ExpoSpeechProvider.ts

import * as Speech from 'expo-speech';
import { TTSProvider, TTSSynthesisOptions, TTSSynthesisResult } from '../../../types/speak';

/**
 * Expo Speech TTS Provider
 * Implements TTSProvider interface for Expo Speech service
 */
export class ExpoSpeechProvider implements TTSProvider {
  readonly name = 'expo';
  private isSpeaking = false;
  private currentCallbacks?: {
    onStart?: () => void;
    onEnd?: () => void;
    onError?: (error: Error) => void;
  };

  async isAvailable(): Promise<boolean> {
    // Expo Speech is always available
    return true;
  }

  async synthesize(
    text: string,
    options?: TTSSynthesisOptions
  ): Promise<TTSSynthesisResult> {
    // Expo Speech doesn't pre-generate audio files
    // Return a virtual URI that will be used in play()
    const encodedText = encodeURIComponent(text);
    const encodedOptions = encodeURIComponent(JSON.stringify({
      language: options?.language || 'zh-CN',
      pitch: options?.pitch || 1.0,
      rate: options?.rate || 0.8,
    }));

    return {
      audioUri: `expo-speech://${encodedText}?options=${encodedOptions}`,
      duration: undefined,
    };
  }

  async play(
    audioUri: string,
    callbacks?: {
      onStart?: () => void;
      onEnd?: () => void;
      onError?: (error: Error) => void;
    }
  ): Promise<void> {
    // Store callbacks
    this.currentCallbacks = callbacks;

    // Parse virtual URI
    const match = audioUri.match(/^expo-speech:\/\/(.+?)(?:\?options=(.+))?$/);
    if (!match) {
      const error = new Error('Invalid expo-speech URI format');
      callbacks?.onError?.(error);
      throw error;
    }

    const text = decodeURIComponent(match[1]);
    const options = match[2] ? JSON.parse(decodeURIComponent(match[2])) : {};

    // Get available voices
    const voices = await Speech.getAvailableVoicesAsync();
    const chineseVoice = voices.find(voice =>
      voice.language.startsWith('zh') ||
      voice.language.includes('Chinese')
    );

    // Prepare speech options
    const speechOptions: Speech.SpeechOptions = {
      language: options.language || 'zh-CN',
      pitch: options.pitch || 1.0,
      rate: options.rate || 0.8,
      voice: chineseVoice?.identifier,
      onStart: () => {
        this.isSpeaking = true;
        this.currentCallbacks?.onStart?.();
      },
      onDone: () => {
        this.isSpeaking = false;
        this.currentCallbacks?.onEnd?.();
        this.currentCallbacks = undefined;
      },
      onStopped: () => {
        this.isSpeaking = false;
        this.currentCallbacks?.onEnd?.();
        this.currentCallbacks = undefined;
      },
      onError: (error) => {
        this.isSpeaking = false;
        const err = new Error(`Expo Speech error: ${error.message || error}`);
        this.currentCallbacks?.onError?.(err);
        this.currentCallbacks = undefined;
      },
    };

    // Start speech synthesis
    Speech.speak(text, speechOptions);
  }

  async stop(): Promise<void> {
    Speech.stop();
    this.isSpeaking = false;
    this.currentCallbacks = undefined;
  }

  async cleanup(): Promise<void> {
    await this.stop();
  }

  /**
   * Check if currently speaking
   */
  get speaking(): boolean {
    return this.isSpeaking;
  }
}
