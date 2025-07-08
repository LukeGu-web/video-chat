import { useState, useEffect } from 'react';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
  getSupportedLocales,
} from 'expo-speech-recognition';

export interface SpeechToTextResult {
  transcript: string;
  confidence?: number;
  isFinal: boolean;
}

export interface UseSpeechToTextReturn {
  isListening: boolean;
  transcript: string;
  error: string | null;
  startListening: () => void;
  stopListening: () => void;
  clearTranscript: () => void;
  isSupported: boolean;
}

export const useSpeechToText = (): UseSpeechToTextReturn => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(false);

  // Check if speech recognition is supported
  useEffect(() => {
    const checkSupport = async () => {
      try {
        const supported = await getSupportedLocales();

        // supported could be array or object depending on platform
        let availableLanguages: any[] = [];

        if (Array.isArray(supported)) {
          // Direct array of locales
          availableLanguages = supported;
        } else if (supported && typeof supported === 'object') {
          // Object with locales and installedLocales
          availableLanguages = [
            ...(supported.locales || []),
            ...(supported.installedLocales || []),
          ];
        }

        setIsSupported(availableLanguages.length > 0);

        if (availableLanguages.length === 0) {
          setError(
            '没有可用的语音识别模型。请在iOS设置中启用听写功能或添加键盘语言。'
          );
        } else {
          setError(`可用语言: ${availableLanguages.join(', ')}`);
        }
      } catch (err) {
        setIsSupported(false);
        setError(`语音识别初始化失败: ${err}`);
      }
    };
    checkSupport();
  }, []);

  // Handle speech recognition events
  useSpeechRecognitionEvent('start', () => {
    setIsListening(true);
    setError(null);
  });

  useSpeechRecognitionEvent('end', () => {
    setIsListening(false);
  });

  useSpeechRecognitionEvent('result', (event) => {
    const results = event.results;
    if (results && results.length > 0) {
      const result = results[0];
      if (result.transcript) {
        setTranscript(result.transcript);
      }
    }
  });

  useSpeechRecognitionEvent('error', (event) => {
    setError(`Speech recognition error: ${event.error}`);
    setIsListening(false);
  });

  const startListening = async () => {
    if (!isSupported) {
      setError('Speech recognition not supported');
      return;
    }

    try {
      setError(null);
      setTranscript('');

      const result =
        await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!result.granted) {
        setError('Microphone permission denied');
        return;
      }

      ExpoSpeechRecognitionModule.start({
        lang: 'zh-CN', // "en-US" 先尝试英语，因为iOS可能没有中文模型
        interimResults: true,
        maxAlternatives: 1,
        continuous: false,
        requiresOnDeviceRecognition: true, // iOS建议使用本地识别
      });
    } catch (err) {
      setError(`Failed to start speech recognition: ${err}`);
      setIsListening(false);
    }
  };

  const stopListening = async () => {
    try {
      ExpoSpeechRecognitionModule.stop();
    } catch (err) {
      setError(`Failed to stop speech recognition: ${err}`);
    }
  };

  const clearTranscript = () => {
    setTranscript('');
    setError(null);
  };

  return {
    isListening,
    transcript,
    error,
    startListening,
    stopListening,
    clearTranscript,
    isSupported,
  };
};
