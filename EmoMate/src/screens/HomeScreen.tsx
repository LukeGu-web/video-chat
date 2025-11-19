import React, { useEffect, useCallback, useState, useRef } from 'react';
import {
  View,
  TouchableOpacity,
  Text,
  ImageBackground,
  ActivityIndicator,
  AppState,
  AppStateStatus,
} from 'react-native';
import { SafeAreaView as SafeAreaViewRN } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useUserStore, ChatMessage, useAIStatus } from '../store';
import { useChatAI } from '../hooks/';
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
  EmotionProvider,
  useEmotionContext,
  EmotionAwareCharacter,
  FunctionMonitor,
} from '../components';
import { EmotionDetector } from '../components/vision';
import { useBackgroundContext } from '../hooks/useBackgroundContext';
import { getBackgroundImageSource } from '../utils/backgroundStory';
import { debugLog, debugWarn, debugError } from '../utils/debug';
import { MonitorProvider, useMonitorContext } from '../contexts/MonitorContext';

type RootStackParamList = {
  Welcome: undefined;
  Home: undefined;
  ChatHistory: undefined;
  Hiyori: undefined;
  SceneHistory: undefined;
};

type HomeScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'Home'
>;

interface Props {
  navigation: HomeScreenNavigationProp;
}

// HomeScreen内容组件
const HomeScreenContent: React.FC<Props> = ({ navigation }) => {
  const { setFacialEmotion } = useEmotionContext();
  const {
    selectedCharacter,
    setSelectedCharacter,
    addEmotionLog,
    chatHistory,
    addChatMessage,
    setCurrentScene,
  } = useUserStore();

  // Background context hook
  const {
    context: backgroundContext,
    isLoading: isBackgroundLoading,
    error: backgroundError,
  } = useBackgroundContext();

  // Monitor context for debug panel
  const { updateBackgroundScene, updateSceneUnderstanding } =
    useMonitorContext();

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

  // Toast state
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'error' | 'success'>('error');

  // Test mode state
  const [isTestMode, setIsTestMode] = useState(false);

  // Step 5.2: Visual QA - store last captured frame
  const lastCapturedFrameRef = useRef<string | null>(null);

  // Step 5.2: Scene Understanding hook with caching
  const apiKey = getClaudeApiKey();

  const sceneUnderstanding = useSceneUnderstanding(apiKey || '', {
    enabled: true,
  });

  // Object Recognition hook
  const objectRecognition = useObjectRecognition(apiKey || '');

  // Object recognition state
  const [isRecognizing, setIsRecognizing] = useState(false);

  // Stable callback for frame capture (prevents useEffect re-triggering)
  const handleFrameCaptured = useCallback(
    (frameBase64: string, timestamp: number) => {
      // Store last captured frame for visual QA and scene understanding
      lastCapturedFrameRef.current = frameBase64;
      debugLog('HomeScreen', `Frame captured: ${Math.round((frameBase64.length * 0.75) / 1024)}KB`);
    },
    []
  );

  // Sync background scene to monitor context
  useEffect(() => {
    if (backgroundContext) {
      updateBackgroundScene({
        sceneId: backgroundContext.scene.id,
        dayType: backgroundContext.scene.dayType,
        timePeriod: backgroundContext.scene.timePeriod,
        location: backgroundContext.scene.location,
        weather: backgroundContext.weather,
        storyPreview: backgroundContext.story.substring(0, 60),
      });
    } else {
      updateBackgroundScene(null);
    }
  }, [backgroundContext, updateBackgroundScene]);

  // Sync scene understanding status to monitor context
  useEffect(() => {
    updateSceneUnderstanding({
      isAnalyzing: sceneUnderstanding.isAnalyzing,
      totalAPICalls: sceneUnderstanding.totalAPICalls,
      currentLocation: sceneUnderstanding.currentScene?.location || null,
      timerEnabled: sceneUnderstanding.timerState.enabled,
      nextCaptureInSeconds: Math.floor(
        sceneUnderstanding.timerState.nextCaptureIn / 1000
      ),
    });
  }, [
    sceneUnderstanding.isAnalyzing,
    sceneUnderstanding.totalAPICalls,
    sceneUnderstanding.currentScene,
    sceneUnderstanding.timerState,
    updateSceneUnderstanding,
  ]);

  // Debug: Log API key once on mount
  useEffect(() => {
    debugLog('HomeScreen', `API Key: ${apiKey ? 'configured' : 'missing'}`);
  }, []);

  // Handle errors (including background errors)
  useEffect(() => {
    if (error || aiError || backgroundError) {
      const message = error || aiError || backgroundError?.message || '';
      setToastMessage(message);
      setToastType('error');
      setShowToast(true);
    }
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

  const handleDismissToast = () => {
    setShowToast(false);
    setToastMessage('');
  };

  useEffect(() => {
    // Character selection updated

    // 示例：设置一个默认角色
    if (!selectedCharacter) {
      setSelectedCharacter('默认AI伴侣');
    }

    // 示例：添加一个情绪日志
    addEmotionLog({
      date: new Date().toISOString().split('T')[0],
      emotion: '开心',
    });
  }, [selectedCharacter, setSelectedCharacter, addEmotionLog]);

  // Background pause - Stop scene detection when app goes to background
  useEffect(() => {
    const subscription = AppState.addEventListener(
      'change',
      (nextAppState: AppStateStatus) => {
        if (nextAppState === 'active') {
          debugLog('HomeScreen', 'App active - starting scene timer');
          sceneUnderstanding.startTimer();
        } else if (
          nextAppState === 'background' ||
          nextAppState === 'inactive'
        ) {
          debugLog('HomeScreen', 'App background - stopping scene timer');
          sceneUnderstanding.stopTimer();
        }
      }
    );

    // Start timer if app is currently active
    if (AppState.currentState === 'active') {
      debugLog('HomeScreen', 'Initial app state: active - starting scene timer');
      sceneUnderstanding.startTimer();
    }

    return () => {
      subscription.remove();
      sceneUnderstanding.stopTimer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Register photo capture callback for scene understanding timer
  useEffect(() => {
    sceneUnderstanding.setPhotoCaptureCallback(async () => {
      if (lastCapturedFrameRef.current) {
        debugLog('HomeScreen', 'Providing captured frame for scene analysis');
        return lastCapturedFrameRef.current;
      } else {
        debugWarn('HomeScreen', 'No captured frame available for scene analysis');
        return null;
      }
    });
  }, [sceneUnderstanding]);

  // Monitor scene updates and sync to userStore
  useEffect(() => {
    const current = sceneUnderstanding.currentScene;
    if (current) {
      setCurrentScene(current);
      debugLog('HomeScreen', `Scene updated: ${current.location}`);
    }
  }, [sceneUnderstanding.currentScene, setCurrentScene]);

  // Initial scene detection on app startup
  useEffect(() => {
    const performInitialSceneDetection = async () => {
      // Check if we have a valid cached scene
      const cached = sceneUnderstanding.currentScene;
      const hasValidScene =
        cached &&
        cached.timestamp &&
        Date.now() - cached.timestamp < 30 * 60 * 1000; // 30 minutes

      if (hasValidScene && cached) {
        debugLog('HomeScreen', `Using cached scene: ${cached.location}`);
        return;
      }

      debugLog('HomeScreen', 'Waiting for camera frame for initial scene detection');

      // Poll for camera frame availability (check every 2 seconds, max 30 seconds)
      let attempts = 0;
      const maxAttempts = 15;

      const checkFrameInterval = setInterval(async () => {
        attempts++;

        if (lastCapturedFrameRef.current) {
          clearInterval(checkFrameInterval);
          debugLog('HomeScreen', 'Starting initial scene detection');

          try {
            await sceneUnderstanding.analyzeScene(
              lastCapturedFrameRef.current,
              undefined
            );
            debugLog('HomeScreen', 'Initial scene detection completed');
          } catch (error) {
            debugError('HomeScreen', 'Initial scene detection failed', error);
          }
        } else if (attempts >= maxAttempts) {
          debugWarn('HomeScreen', 'Timeout waiting for camera frame');
          clearInterval(checkFrameInterval);
        }
      }, 2000);
    };

    performInitialSceneDetection();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleGoBack = () => {
    navigation.goBack();
  };

  const handleGoToChatHistory = () => {
    navigation.navigate('ChatHistory');
  };

  const handleGoToSceneHistory = () => {
    navigation.navigate('SceneHistory');
  };

  // Handle object recognition
  const handleRecognizeObject = async () => {
    if (!lastCapturedFrameRef.current) {
      setToastMessage('请等待摄像头捕获画面');
      setToastType('error');
      setShowToast(true);
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
        debugLog('HomeScreen', `Object recognized: ${response.object.objectName}`);
        setToastMessage(`识别成功: ${response.object.objectName}`);
        setToastType('success');
        setShowToast(true);
      } else {
        debugError('HomeScreen', 'Recognition failed', response.error);
        setToastMessage(response.error || '识别失败，请重试');
        setToastType('error');
        setShowToast(true);
      }
    } catch (error) {
      debugError('HomeScreen', 'Recognition error', error);
      setToastMessage('识别过程中发生错误');
      setToastType('error');
      setShowToast(true);
    } finally {
      setIsRecognizing(false);
    }
  };

  // Manual scene analysis test
  const handleManualSceneTest = useCallback(async () => {
    debugLog('HomeScreen', 'Manual scene test triggered');

    if (!apiKey) {
      setToastMessage('API Key 未配置，请检查 .env 文件');
      setToastType('error');
      setShowToast(true);
      return;
    }

    if (!lastCapturedFrameRef.current) {
      setToastMessage('摄像头还未捕获帧，请稍候再试');
      setToastType('error');
      setShowToast(true);
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
      setToastMessage(
        `场景分析失败: ${error instanceof Error ? error.message : '未知错误'}`
      );
      setToastType('error');
      setShowToast(true);
    }
  }, [apiKey, sceneUnderstanding]);

  // 生成唯一消息ID
  const generateMessageId = () => {
    return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  };

  // Step 2.3: Use AI conversation flow hook
  const { startConversation } = useAIConversationFlow({
    sendMessage,
    sceneUnderstanding,
    objectRecognition,
    backgroundContext,
    addChatMessage,
    setCurrentScene,
    setToast: (message: string, type: 'error' | 'success') => {
      setToastMessage(message);
      setToastType(type);
      setShowToast(true);
    },
    getCapturedFrame: () => lastCapturedFrameRef.current,
    generateMessageId,
  });

  // 核心语音对话流程（使用 AI conversation flow hook）
  const handleVoiceConversation = useCallback(
    async (userText: string) => {
      await startConversation(userText);
    },
    [startConversation]
  );

  // 监听语音识别完成
  useEffect(() => {
    if (!isListening && transcript) {
      // 语音识别完成且有文本时，清空transcript并发送给AI
      handleVoiceConversation(transcript);
      clearTranscript();
    }
  }, [isListening, transcript, handleVoiceConversation, clearTranscript]);

  // 监听AI消息并添加到聊天历史
  useEffect(() => {
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.role === 'assistant') {
        // 检查是否已经在chatHistory中
        const existsInHistory = chatHistory.some(
          (msg) =>
            msg.content === lastMessage.content &&
            Math.abs(msg.timestamp - lastMessage.timestamp) < 1000
        );

        if (!existsInHistory) {
          const aiMessage: ChatMessage = {
            id: generateMessageId(),
            role: 'assistant',
            content: lastMessage.content,
            timestamp: lastMessage.timestamp,
            isVoiceMessage: true,
          };
          addChatMessage(aiMessage);
        }
      }
    }
  }, [messages, chatHistory, addChatMessage]);

  if (isTestMode) {
    return (
      <SafeAreaViewRN className='flex-1 bg-background'>
        {/* Test Mode Header */}
        <View className='flex-row items-center justify-between p-4 bg-white border-b border-gray-200'>
          <TouchableOpacity
            onPress={() => setIsTestMode(false)}
            className='px-4 py-2 bg-blue-500 rounded-lg'
          >
            <Text className='font-medium text-white'>返回聊天</Text>
          </TouchableOpacity>
          <View className='w-20' />
        </View>
      </SafeAreaViewRN>
    );
  }

  // Get background image source
  const backgroundSource = backgroundContext
    ? getBackgroundImageSource(backgroundContext.imagePath)
    : require('../../assets/background/afternoon.jpeg'); // Fallback

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
      <SafeAreaViewRN className='flex-1'>
        {/* Toast (Error/Success) */}
        <Toast
          message={toastMessage}
          isVisible={showToast}
          onDismiss={handleDismissToast}
          duration={4000}
          type={toastType}
        />

        <Header
          onGoToChatHistory={handleGoToChatHistory}
          onGoToSceneHistory={handleGoToSceneHistory}
        />

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
        <View className='absolute px-4 left-8 bottom-8'>
          <TouchableOpacity
            onPress={handleRecognizeObject}
            disabled={isRecognizing || objectRecognition.isLoading}
            className={`w-20 h-20 rounded-full items-center justify-center shadow-lg ${
              isRecognizing || objectRecognition.isLoading
                ? 'bg-gray-400'
                : 'bg-green-500'
            }`}
            style={{
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
              elevation: 8,
            }}
          >
            {isRecognizing || objectRecognition.isLoading ? (
              <ActivityIndicator size='small' color='#fff' />
            ) : (
              <Text className='text-3xl'>📷</Text>
            )}
            <Text className='text-xs text-center text-white'>
              {isRecognizing || objectRecognition.isLoading
                ? '识别中...'
                : '识别物品'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Facial Emotion Detection */}
        <EmotionDetector
          onEmotionDetected={setFacialEmotion}
          isActive={true}
          detectionInterval={3000}
          onFrameCaptured={handleFrameCaptured}
          frameCaptureInterval={5000} // 5 seconds - faster initial capture for scene understanding
        />

        {/* Function Monitor - Unified Debug Panel */}
        <FunctionMonitor
          onTestSceneAnalysis={handleManualSceneTest}
          isAnalyzing={sceneUnderstanding.isAnalyzing}
        />
      </SafeAreaViewRN>
    </ImageBackground>
  );
};

// 带情绪提供器和监控提供器的HomeScreen包装器
const HomeScreen: React.FC<Props> = ({ navigation }) => {
  return (
    <MonitorProvider>
      <EmotionProvider>
        <HomeScreenContent navigation={navigation} />
      </EmotionProvider>
    </MonitorProvider>
  );
};

export default HomeScreen;
