import { useState, useCallback } from 'react';
import * as Speech from 'expo-speech';

export interface TTSConfig {
  language?: string;
  pitch?: number;
  rate?: number;
  voice?: string;
}

export interface UseTTSReturn {
  isSpeaking: boolean;
  speak: (text: string, config?: TTSConfig) => Promise<void>;
  stop: () => void;
  error: string | null;
}

// TTS 配置常量
const DEFAULT_TTS_CONFIG = {
  language: 'zh-CN', // 中文
  pitch: 1.0,        // 音调
  rate: 0.8,         // 语速（稍慢一些更自然）
} as const;

// 备用语言配置
const FALLBACK_CONFIG = {
  language: 'en-US',
  pitch: 1.0,
  rate: 0.75,
} as const;

export const useTTS = (initialConfig?: TTSConfig): UseTTSReturn => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const speak = useCallback(async (text: string, config?: TTSConfig) => {
    if (!text.trim()) return;

    try {
      setError(null);
      setIsSpeaking(true);

      // 检查是否有可用的语音
      const voices = await Speech.getAvailableVoicesAsync();
      console.log('Available voices:', voices);

      // 合并配置
      const ttsConfig = {
        ...DEFAULT_TTS_CONFIG,
        ...initialConfig,
        ...config,
      };

      // 查找中文语音
      const chineseVoice = voices.find(voice => 
        voice.language.startsWith('zh') || 
        voice.language.includes('Chinese')
      );

      // 如果没有中文语音，使用英文语音
      let finalConfig = ttsConfig;
      if (!chineseVoice && ttsConfig.language?.startsWith('zh')) {
        console.log('No Chinese voice found, using English fallback');
        finalConfig = {
          ...ttsConfig,
          ...FALLBACK_CONFIG,
        };
      }

      // 语音合成选项
      const speechOptions: Speech.SpeechOptions = {
        language: finalConfig.language,
        pitch: finalConfig.pitch,
        rate: finalConfig.rate,
        voice: finalConfig.voice || chineseVoice?.identifier,
        onStart: () => {
          console.log('TTS started');
          setIsSpeaking(true);
        },
        onDone: () => {
          console.log('TTS finished');
          setIsSpeaking(false);
        },
        onStopped: () => {
          console.log('TTS stopped');
          setIsSpeaking(false);
        },
        onError: (error) => {
          console.error('TTS error:', error);
          setError(`语音播放失败: ${error.message || error}`);
          setIsSpeaking(false);
        },
      };

      // 开始语音合成
      await Speech.speak(text, speechOptions);

    } catch (err) {
      console.error('TTS speak error:', err);
      setError(err instanceof Error ? err.message : '语音合成失败');
      setIsSpeaking(false);
    }
  }, [initialConfig]);

  const stop = useCallback(() => {
    try {
      Speech.stop();
      setIsSpeaking(false);
      setError(null);
    } catch (err) {
      console.error('TTS stop error:', err);
      setError('停止语音播放失败');
    }
  }, []);

  return {
    isSpeaking,
    speak,
    stop,
    error,
  };
};