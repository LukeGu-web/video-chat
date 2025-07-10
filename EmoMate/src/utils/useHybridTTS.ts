import { useState, useCallback } from 'react';
import { useTTS } from './useTTS';
import { useElevenLabsTTS } from './useElevenLabsTTS';
import { getElevenLabsApiKey } from '../constants/ai';

export type TTSProvider = 'expo' | 'elevenlabs';

export interface UseHybridTTSConfig {
  preferredProvider?: TTSProvider;
  fallbackToExpo?: boolean;
}

export interface UseHybridTTSReturn {
  isSpeaking: boolean;
  isGenerating: boolean; // 新增：是否正在生成语音
  error: string | null;
  currentProvider: TTSProvider;
  speak: (text: string, voiceId?: string, userEmotion?: string) => Promise<void>;
  stop: () => Promise<void>;
  switchProvider: (provider: TTSProvider) => void;
  currentSegment: string; // 当前正在播放的语音片段
}

export const useHybridTTS = (config?: UseHybridTTSConfig): UseHybridTTSReturn => {
  const [currentProvider, setCurrentProvider] = useState<TTSProvider>(() => {
    // 如果有 ElevenLabs API key 且用户偏好是 ElevenLabs，则使用 ElevenLabs
    const hasElevenLabsKey = !!getElevenLabsApiKey();
    const preferred = config?.preferredProvider;
    
    if (preferred === 'elevenlabs' && hasElevenLabsKey) {
      return 'elevenlabs';
    }
    
    // 如果有 ElevenLabs API key 但用户没有明确偏好，默认使用 ElevenLabs
    if (hasElevenLabsKey) {
      return 'elevenlabs';
    }
    
    return 'expo';
  });

  const expoTTS = useTTS();
  const elevenLabsTTS = useElevenLabsTTS();

  const speak = useCallback(async (text: string, voiceId?: string, userEmotion?: string) => {
    try {
      if (currentProvider === 'elevenlabs') {
        // 尝试使用 ElevenLabs，传递情绪参数
        await elevenLabsTTS.speak(text, voiceId, userEmotion);
      } else {
        // 使用 Expo Speech
        await expoTTS.speak(text);
      }
    } catch (error) {
      // 如果 ElevenLabs 失败且允许回退，则使用 Expo Speech
      if (currentProvider === 'elevenlabs' && config?.fallbackToExpo) {
        console.warn('ElevenLabs TTS failed, falling back to Expo Speech:', error);
        try {
          await expoTTS.speak(text);
        } catch (fallbackError) {
          console.error('Expo Speech fallback also failed:', fallbackError);
          throw fallbackError;
        }
      } else {
        throw error;
      }
    }
  }, [currentProvider, expoTTS, elevenLabsTTS, config?.fallbackToExpo]);

  const stop = useCallback(async () => {
    // 停止所有 TTS 提供商
    await Promise.all([
      expoTTS.stop(),
      elevenLabsTTS.stop(),
    ]);
  }, [expoTTS, elevenLabsTTS]);

  const switchProvider = useCallback((provider: TTSProvider) => {
    // 先停止当前播放
    stop();
    setCurrentProvider(provider);
  }, [stop]);

  // 合并状态
  const isSpeaking = currentProvider === 'elevenlabs' 
    ? elevenLabsTTS.isSpeaking 
    : expoTTS.isSpeaking;

  const isGenerating = currentProvider === 'elevenlabs' 
    ? elevenLabsTTS.isGenerating 
    : false; // Expo TTS 没有生成阶段

  const error = currentProvider === 'elevenlabs' 
    ? elevenLabsTTS.error 
    : expoTTS.error;

  const currentSegment = currentProvider === 'elevenlabs'
    ? elevenLabsTTS.currentSegment
    : ''; // Expo TTS 没有段落功能

  return {
    isSpeaking,
    isGenerating,
    error,
    currentProvider,
    speak,
    stop,
    switchProvider,
    currentSegment,
  };
};