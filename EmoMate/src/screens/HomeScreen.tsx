import React, { useEffect, useCallback, useState, useRef, useMemo } from 'react';
import { View, Text, ImageBackground, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useUserStore, useAIStatus } from '../store';
import {
  useChatAI,
  useToast,
  useInitialSceneDetection,
  useAppStateSceneTimer,
  useBackgroundSceneManager,
  useSceneUnderstandingMonitor,
  useVoiceConversationManager,
} from '../hooks/';
import { useAIConversationFlow } from '../hooks/useAIConversationFlow'; // Step 2.3: AI conversation flow hook
import { useSpeechToText } from '../capabilities/listen';
import {
  useSceneUnderstanding,
  useObjectRecognition,
} from '../capabilities/vision';
import { PERSONALITY_PROMPTS, getClaudeApiKey } from '../constants';
import {
  Header,
  VoiceControl,
  Toast,
  CurrentSpeechBubble,
  EmotionAwareCharacter,
  FunctionMonitor,
  ObjectRecognitionButton,
} from '../components';
import { EmotionDetector } from '../components/vision';
import { debugLog, debugWarn, debugError } from '../utils/debug';
import { useEmotionStore } from '../store';

// Emotion detector configuration constants (avoid re-creating on each render)
const EMOTION_DETECTOR_CONFIG = {
  isActive: true,
  detectionInterval: 3000,
  frameCaptureInterval: 5000, // 5 seconds - faster initial capture for scene understanding
} as const;

// HomeScreen内容组件
const HomeScreen: React.FC = () => {
  const setFacialEmotion = useEmotionStore((state) => state.setFacialEmotion);
  const { addChatMessage, setCurrentScene } = useUserStore();

  // Background scene management (consolidates 3 useEffects)
  const {
    backgroundContext,
    isBackgroundLoading,
    backgroundError,
    backgroundSource,
  } = useBackgroundSceneManager();

  const { setAIStatus } = useAIStatus();
  const {
    isListening,
    transcript,
    error,
    startListening,
    stopListening,
    clearTranscript,
    isSupported,
  } = useSpeechToText();

  const {
    messages,
    isLoading: isAILoading,
    isSpeaking,
    isGenerating,
    error: aiError,
    sendMessage,
    stopSpeaking,
    currentSegment,
  } = useChatAI({ personality: PERSONALITY_PROMPTS.gentle, enableTTS: true });

  // Toast management
  const { toastState, showError, showSuccess, dismissToast } = useToast();

  // Step 5.2: Visual QA - store last captured frame for scene understanding
  const lastCapturedFrameRef = useRef<string | null>(null);

  const apiKey = getClaudeApiKey();

  const sceneUnderstanding = useSceneUnderstanding(apiKey || '', {
    enabled: true,
  });

  // Object Recognition hook
  const objectRecognition = useObjectRecognition(apiKey || '');

  // Object recognition state
  const [isRecognizing, setIsRecognizing] = useState(false);

  // Stable callback for frame capture (prevents useEffect re-triggering)
  const handleFrameCaptured = useCallback((frameBase64: string) => {
    // Store last captured frame for visual QA and scene understanding
    lastCapturedFrameRef.current = frameBase64;
    debugLog(
      'HomeScreen',
      `Frame captured: ${Math.round((frameBase64.length * 0.75) / 1024)}KB`
    );
  }, []);

  // Stable callback to get captured frame
  const getCapturedFrame = useCallback(() => {
    return lastCapturedFrameRef.current;
  }, []);

  // Scene understanding monitoring (consolidates 2 useEffects)
  useSceneUnderstandingMonitor(sceneUnderstanding);

  // Debug: Log API key once on mount
  useEffect(() => {
    debugLog('HomeScreen', `API Key: ${apiKey ? 'configured' : 'missing'}`);
  }, [apiKey]);

  // Handle errors (including background errors)
  useEffect(() => {
    if (error || aiError || backgroundError) {
      const message = error || aiError || backgroundError?.message || '';
      showError(message);
    }
    // showError is stable (empty deps), no need to include in deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error, aiError, backgroundError]);

  // 统一的 AI 状态管理 - 直接使用Hiyori动作
  useEffect(() => {
    if (isListening) {
      // 1. 开始语音识别时：使用Thinking动作（倾听思考状态）
      setAIStatus('Thinking');
    } else if (isGenerating) {
      // 2. 正在生成回复：Thinking 动作
      setAIStatus('Thinking');
    } else if (isSpeaking) {
      // 3. 正在播放 TTS：Speaking 动作
      setAIStatus('Speaking');
    } else {
      // 4. 其他情况：Idle 动作
      setAIStatus('Idle');
    }
  }, [isListening, isGenerating, isSpeaking, setAIStatus]);

  // Background pause - Stop scene detection when app goes to background
  useAppStateSceneTimer({
    sceneUnderstanding,
    enabled: true,
  });

  // Register photo capture callback for scene understanding timer (once)
  useEffect(() => {
    sceneUnderstanding.setPhotoCaptureCallback(async () => {
      if (lastCapturedFrameRef.current) {
        debugLog('HomeScreen', 'Providing captured frame for scene analysis');
        return lastCapturedFrameRef.current;
      } else {
        debugWarn(
          'HomeScreen',
          'No captured frame available for scene analysis'
        );
        return null;
      }
    });
  }, []);

  // Initial scene detection on app startup
  useInitialSceneDetection({
    sceneUnderstanding,
    getCapturedFrame,
    enabled: true,
  });

  // Handle object recognition
  const handleRecognizeObject = async () => {
    if (!lastCapturedFrameRef.current) {
      showError('请等待摄像头捕获画面');
      return;
    }

    if (isRecognizing || objectRecognition.isLoading) {
      return;
    }

    setIsRecognizing(true);
    debugLog('HomeScreen', 'Starting object recognition');

    try {
      const response = await objectRecognition.recognizeObject(
        lastCapturedFrameRef.current,
        '识别这个物品'
      );

      if (response.success) {
        debugLog(
          'HomeScreen',
          `Object recognized: ${response.object.objectName}`
        );
        showSuccess(`识别成功: ${response.object.objectName}`);
      } else {
        debugError('HomeScreen', 'Recognition failed', response.error);
        showError(response.error || '识别失败，请重试');
      }
    } catch (error) {
      debugError('HomeScreen', 'Recognition error', error);
      showError('识别过程中发生错误');
    } finally {
      setIsRecognizing(false);
    }
  };

  // Manual scene analysis test
  const handleManualSceneTest = useCallback(async () => {
    debugLog('HomeScreen', 'Manual scene test triggered');

    if (!apiKey) {
      showError('API Key 未配置，请检查 .env 文件');
      return;
    }

    if (!lastCapturedFrameRef.current) {
      showError('摄像头还未捕获帧，请稍候再试');
      return;
    }

    try {
      debugLog('HomeScreen', 'Starting manual scene analysis');
      await sceneUnderstanding.analyzeScene(
        lastCapturedFrameRef.current,
        '手动测试场景分析'
      );
      debugLog('HomeScreen', 'Manual scene analysis completed');
    } catch (error) {
      debugError('HomeScreen', 'Manual scene analysis failed', error);
      showError(
        `场景分析失败: ${error instanceof Error ? error.message : '未知错误'}`
      );
    }
    // showError is stable (empty deps), no need to include in deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey, sceneUnderstanding]);

  // 生成唯一消息ID
  const generateMessageId = useCallback(() => {
    return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }, []);

  // Stable callback for toast notifications in AI conversation flow
  const setToast = useCallback((message: string, type: 'error' | 'success') => {
    if (type === 'error') {
      showError(message);
    } else {
      showSuccess(message);
    }
    // showError and showSuccess are stable (empty deps), no need to include in deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Step 2.3: Use AI conversation flow hook
  const { startConversation } = useAIConversationFlow({
    sendMessage,
    sceneUnderstanding,
    objectRecognition,
    backgroundContext,
    addChatMessage,
    setCurrentScene,
    setToast,
    getCapturedFrame,
    generateMessageId,
  });

  // Voice conversation management (consolidates 2 useEffects)
  useVoiceConversationManager({
    isListening,
    transcript,
    messages,
    startConversation,
    clearTranscript,
    addChatMessage,
    generateMessageId,
  });

  // Show loading indicator while background is loading
  if (isBackgroundLoading) {
    return (
      <View className='items-center justify-center flex-1 bg-background'>
        <ActivityIndicator size='large' color='#3B82F6' />
        <Text className='mt-4 text-gray-600'>加载背景场景...</Text>
      </View>
    );
  }

  return (
    <ImageBackground
      source={backgroundSource}
      className='flex-1'
      resizeMode='cover'
    >
      <SafeAreaView className='flex-1'>
        {/* Toast (Error/Success) */}
        <Toast
          message={toastState.message}
          isVisible={toastState.isVisible}
          onDismiss={dismissToast}
          duration={4000}
          type={toastState.type}
        />

        <Header />

        {/* Main Content Area - Full screen with character at bottom */}
        <View className='justify-end flex-1'>
          {/* Current Speech Bubble - Above character's head */}
          <View className='min-h-[120px] justify-end px-4'>
            {isSpeaking && currentSegment && (
              <CurrentSpeechBubble currentMessage={currentSegment} />
            )}
          </View>

          {/* Live2D Character - Standing at the bottom, extends beyond bottom edge */}
          <View className='items-center -mb-24'>
            <EmotionAwareCharacter
              size={450}
              loop={true}
              className='shadow-lg'
              enableEmotionMapping={true}
            />
          </View>
        </View>

        {/* Voice Control - Floating over character's lower body */}
        <View className='absolute px-4 right-8 bottom-8'>
          <VoiceControl
            isListening={isListening}
            isSupported={isSupported}
            isAILoading={isAILoading}
            isSpeaking={isSpeaking}
            isGenerating={isGenerating}
            error={error}
            onStartListening={startListening}
            onStopListening={stopListening}
            onStopSpeaking={stopSpeaking}
          />
        </View>

        {/* Object Recognition Button - Floating on left side */}
        <ObjectRecognitionButton
          onRecognize={handleRecognizeObject}
          isRecognizing={isRecognizing}
          disabled={objectRecognition.isLoading}
        />

        {/* Facial Emotion Detection */}
        <EmotionDetector
          onEmotionDetected={setFacialEmotion}
          onFrameCaptured={handleFrameCaptured}
          {...EMOTION_DETECTOR_CONFIG}
        />

        {/* Function Monitor - Unified Debug Panel */}
        <FunctionMonitor
          onTestSceneAnalysis={handleManualSceneTest}
          isAnalyzing={sceneUnderstanding.isAnalyzing}
        />
      </SafeAreaView>
    </ImageBackground>
  );
};

export default HomeScreen;
