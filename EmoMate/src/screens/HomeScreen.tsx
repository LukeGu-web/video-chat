import React, { useEffect, useCallback, useState, useRef } from 'react';
import { View, Text, ImageBackground, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useIsFocused } from '@react-navigation/native';
import { useAIStatus, useSceneStore } from '../store';
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
import { useMemoryTriggers } from '../hooks/useMemoryTriggers';
import { useSpeechToText } from '../capabilities/listen';
import { useTTS } from '../capabilities/speak';
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
import {
  createRecognitionPrompt,
  isConfidenceAcceptable,
} from '../utils/objectRecognitionHelper';

// Emotion detector configuration constants (avoid re-creating on each render)
const EMOTION_DETECTOR_CONFIG = {
  detectionInterval: 30000,
  frameCaptureInterval: 5000, // 5 seconds - faster initial capture for scene understanding
} as const;

// HomeScreen内容组件
const HomeScreen: React.FC = () => {
  const isFocused = useIsFocused(); // Monitor screen focus state
  const setFacialEmotion = useEmotionStore((state) => state.setFacialEmotion);
  const setCurrentScene = useSceneStore((state) => state.setCurrentScene);

  // Background scene management (consolidates 3 useEffects)
  const {
    backgroundContext,
    isBackgroundLoading,
    backgroundError,
    backgroundSource,
  } = useBackgroundSceneManager();

  // AI Status management (new multi-dimensional state)
  const { setLooking, setThinking, setBatchStates } = useAIStatus();

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

  // Memory trigger system: message count, silence, background, and startup checks
  useMemoryTriggers({
    messages,
    enabled: true,
  });

  // TTS for small talk (voice-triggered object recognition only)
  const smallTalkTTS = useTTS({
    provider: 'fishaudio',
    mode: 'simple',
    fallbackToExpo: true,
  });

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

  // Handle errors (including background errors)
  useEffect(() => {
    if (error || aiError || backgroundError) {
      const message = error || aiError || backgroundError?.message || '';
      showError(message);
    }
  }, [error, aiError, backgroundError]);

  // Sync useChatAI states to useAIStatus (multi-dimensional state model)
  // Use batch update to prevent race conditions and unnecessary re-renders
  useEffect(() => {
    setBatchStates({
      isListening,
      isThinking: isGenerating,
      isSpeaking,
    });
  }, [isListening, isGenerating, isSpeaking, setBatchStates]);

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

  // Handle object recognition (button triggered - no small talk needed)
  const handleRecognizeObject = async () => {
    if (!lastCapturedFrameRef.current) {
      showError('请等待摄像头捕获画面');
      return;
    }

    if (isRecognizing || objectRecognition.isLoading) {
      return;
    }

    setIsRecognizing(true);
    setLooking(true);
    debugLog('HomeScreen', 'Starting button-triggered object recognition');

    try {
      // Call Vision API directly (no small talk for button trigger)
      setThinking(true);
      const response = await objectRecognition.recognizeObject(
        lastCapturedFrameRef.current,
        '识别这个物品'
      );
      setThinking(false);

      // Handle result and use AI to announce
      if (response.success) {
        const object = response.object;
        debugLog('HomeScreen', `Object recognized: ${object.objectName}`, {
          confidence: object.confidence,
          category: object.category,
        });

        // Check confidence level
        if (!isConfidenceAcceptable(object.confidence)) {
          // Low confidence - use AI to explain retry
          const errorPrompt = createRecognitionPrompt(
            object,
            false,
            '识别置信度较低'
          );
          await sendMessage(errorPrompt);
        } else {
          // Success - use AI to announce result naturally
          const announcement = createRecognitionPrompt(object, true);
          await sendMessage(announcement);
        }
      } else {
        // Recognition failed - use AI to handle error
        debugError('HomeScreen', 'Recognition failed', response.error);
        const errorPrompt = createRecognitionPrompt(
          {
            objectName: '未知',
            category: '未知',
            description: '',
            confidence: 0,
            timestamp: Date.now(),
          },
          false,
          response.error
        );
        await sendMessage(errorPrompt);
      }
    } catch (error) {
      debugError('HomeScreen', 'Recognition error', error);

      // Use AI to handle unexpected error
      const errorMsg = error instanceof Error ? error.message : '未知错误';
      await sendMessage(`识别过程中发生了错误：${errorMsg}。要不要再试一次？`);
    } finally {
      setIsRecognizing(false);
      setLooking(false);
      setThinking(false);
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
    setCurrentScene,
    setToast,
    getCapturedFrame,
    // Small talk support for voice-triggered recognition
    smallTalkTTS,
    setLooking,
    setThinking,
  });

  // Voice conversation management (consolidates 2 useEffects)
  useVoiceConversationManager({
    isListening,
    transcript,
    startConversation,
    clearTranscript,
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

        {/* Control Buttons Container - Unified layout for Voice and Object Recognition */}
        <View className='absolute left-0 right-0 flex-row justify-between px-8 bottom-8'>
          {/* Object Recognition Button - Left side */}
          <ObjectRecognitionButton
            onRecognize={handleRecognizeObject}
            isRecognizing={isRecognizing}
            disabled={objectRecognition.isLoading}
          />

          {/* Voice Control - Right side */}
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

        {/* Facial Emotion Detection - Only active when screen is focused */}
        <EmotionDetector
          onEmotionDetected={setFacialEmotion}
          onFrameCaptured={handleFrameCaptured}
          isActive={isFocused} // Stop detection when screen loses focus
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
