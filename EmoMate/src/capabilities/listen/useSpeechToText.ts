import { useState, useEffect } from 'react';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
  getSupportedLocales,
} from 'expo-speech-recognition';
import { audioModeManager } from '../../utils/audioModeManager';

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
          // setError(`可用语言: ${availableLanguages.join(', ')}`);
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

  useSpeechRecognitionEvent('end', async () => {
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

      // Note: Permission should already be granted in WelcomeScreen
      // Check permission status to provide better error messages
      const permissionStatus =
        await ExpoSpeechRecognitionModule.getPermissionsAsync();

      if (!permissionStatus.granted) {
        setError('语音识别权限未授予，请在设置中开启');
        return;
      }

      // Fix: Set audio mode to recording before starting speech recognition
      // This ensures proper audio routing for microphone input
      try {
        await audioModeManager.setRecordingMode();
      } catch (error) {
        console.warn('[SpeechToText] Failed to set recording mode:', error);
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

      // Fix: Critical - Set allowsRecording to false after stopping recording
      // This ensures audio playback routes through speaker instead of earpiece
      // Reference: https://snack.expo.dev/@keith-kurak/ios---recording-sound-forces-future-playback-to-earpiece
      try {
        await audioModeManager.setPlaybackMode(); // Sets allowsRecording: false
        console.log(
          '[SpeechToText] Audio mode set to playback after stopping recording'
        );
      } catch (error) {
        console.warn(
          '[SpeechToText] Failed to set playback mode after recording:',
          error
        );
      }
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
