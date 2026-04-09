// src/capabilities/speak/hooks/useTTS.ts

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  TTSConfig,
  TTSProviderType,
  TTSSynthesisOptions,
  TTSProvider,
} from '../../../types/speak';
import { FishAudioProvider } from '../providers/FishAudioProvider';
import { ExpoSpeechProvider } from '../providers/ExpoSpeechProvider';

/**
 * useTTS Hook return type
 */
export interface UseTTSReturn {
  isSpeaking: boolean;
  isGenerating: boolean;
  error: string | null;
  currentProvider: TTSProviderType;
  speak(text: string, options?: TTSSynthesisOptions): Promise<void>;
  stop(): Promise<void>;
  switchProvider(provider: TTSProviderType): void;
}

/**
 * Unified TTS Hook
 * Supports both simple playback modes with automatic provider switching
 */
export function useTTS(config?: Partial<TTSConfig>): UseTTSReturn {
  // State
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentProvider, setCurrentProvider] = useState<TTSProviderType>(
    config?.provider || 'fishaudio'
  );

  // Provider instances
  const providersRef = useRef<Map<TTSProviderType, TTSProvider>>(new Map());

  // Initialize providers
  useEffect(() => {
    const providers = providersRef.current;
    providers.set('fishaudio', new FishAudioProvider());
    providers.set('expo', new ExpoSpeechProvider());

    return () => {
      // Cleanup on unmount
      providers.forEach((provider) => provider.cleanup());
      providers.clear();
    };
  }, []);

  // Get current provider instance
  const getProvider = useCallback((): TTSProvider => {
    const provider = providersRef.current.get(currentProvider);
    if (!provider) {
      throw new Error(`Provider ${currentProvider} not initialized`);
    }
    return provider;
  }, [currentProvider]);

  // Simple speak
  const speak = useCallback(
    async (text: string, options?: TTSSynthesisOptions) => {
      if (!text.trim()) return;

      try {
        setError(null);
        setIsGenerating(true);

        const provider = getProvider();

        // Check if provider is available
        const isAvailable = await provider.isAvailable();
        if (!isAvailable && currentProvider === 'fishaudio' && config?.fallbackToExpo) {
          console.warn('[useTTS] ElevenLabs not available, falling back to Expo Speech');
          setCurrentProvider('expo');
          setIsGenerating(false);
          await speak(text, options);
          return;
        }

        // Synthesize
        const result = await provider.synthesize(text, options);
        setIsGenerating(false);

        // Play
        await provider.play(result.audioUri, {
          onStart: () => setIsSpeaking(true),
          onEnd: () => setIsSpeaking(false),
          onError: (err) => {
            setError(err.message);
            setIsSpeaking(false);
          },
        });
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'TTS failed';
        setError(errorMessage);
        setIsGenerating(false);
        setIsSpeaking(false);

        // Fallback to Expo if configured
        if (config?.fallbackToExpo && currentProvider === 'fishaudio') {
          console.warn('[useTTS] ElevenLabs failed, falling back to Expo Speech');
          setCurrentProvider('expo');
          await speak(text, options);
        }
      }
    },
    [currentProvider, config?.fallbackToExpo, getProvider]
  );

  // Stop
  const stop = useCallback(async () => {
    try {
      const provider = getProvider();
      await provider.stop();
      setIsSpeaking(false);
      setIsGenerating(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Stop failed');
    }
  }, [getProvider]);

  // Switch provider
  const switchProvider = useCallback(
    (provider: TTSProviderType) => {
      stop();
      setCurrentProvider(provider);
    },
    [stop]
  );

  return {
    isSpeaking,
    isGenerating,
    error,
    currentProvider,
    speak,
    stop,
    switchProvider,
  };
}
