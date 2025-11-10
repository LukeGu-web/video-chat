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
import { useSpeechToText, useChatAI } from '../utils';
import { useSceneUnderstanding, detectVisualKeywords } from '../utils/useSceneUnderstanding';
import { PERSONALITY_PROMPTS, getClaudeApiKey } from '../constants';
import {
  Header,
  VoiceControl,
  ErrorToast,
  CurrentSpeechBubble,
  EmotionProvider,
  useEmotionContext,
  EmotionAwareCharacter,
  BasicEmotionDetector,
} from '../components';
import { useBackgroundContext } from '../hooks/useBackgroundContext';
import {
  getBackgroundImageSource,
  formatStoryForAI,
} from '../utils/backgroundStory';
import { isDebugMode } from '../utils/debug';

type RootStackParamList = {
  Welcome: undefined;
  Home: undefined;
  ChatHistory: undefined;
  Hiyori: undefined;
  EmotionTest: undefined;
  EnvironmentTest: undefined;
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

  // Error toast state
  const [showErrorToast, setShowErrorToast] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Test mode state
  const [isTestMode, setIsTestMode] = useState(false);

  // Step 5.2: Visual QA - store last captured frame
  const lastCapturedFrameRef = useRef<string | null>(null);

  // Step 5.2: Scene Understanding hook with caching
  const apiKey = getClaudeApiKey();
  const sceneUnderstanding = useSceneUnderstanding(apiKey || '', {
    enabled: true,
  });

  // Handle errors (including background errors)
  useEffect(() => {
    if (error || aiError || backgroundError) {
      const message = error || aiError || backgroundError?.message || '';
      setErrorMessage(message);
      setShowErrorToast(true);
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

  const handleDismissError = () => {
    setShowErrorToast(false);
    setErrorMessage('');
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

  // Step 5.3: Background pause - Stop scene detection when app goes to background
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        console.log('[HomeScreen] 📱 App is active - starting scene timer');
        sceneUnderstanding.startTimer();
      } else if (nextAppState === 'background' || nextAppState === 'inactive') {
        console.log('[HomeScreen] 📴 App is background/inactive - stopping scene timer');
        sceneUnderstanding.stopTimer();
      }
    });

    // Start timer if app is currently active
    if (AppState.currentState === 'active') {
      console.log('[HomeScreen] 📱 Initial state: App is active - starting scene timer');
      sceneUnderstanding.startTimer();
    }

    return () => {
      subscription.remove();
      sceneUnderstanding.stopTimer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency - only run once on mount

  const handleGoBack = () => {
    navigation.goBack();
  };

  const handleGoToChatHistory = () => {
    navigation.navigate('ChatHistory');
  };

  const handleGoToSceneHistory = () => {
    navigation.navigate('SceneHistory');
  };

  const handleGoToEmotionTest = () => {
    navigation.navigate('EmotionTest');
  };

  const handleGoToEnvironmentTest = () => {
    navigation.navigate('EnvironmentTest');
  };

  // 生成唯一消息ID
  const generateMessageId = () => {
    return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  };

  // AI 对话流程
  const runAIFlow = useCallback(
    async (inputText: string) => {
      if (!inputText.trim()) return;

      try {
        // Step 5.3: Notify conversation activity (smart pause)
        sceneUnderstanding.notifyConversationActivity();

        // 1. 添加用户消息到聊天历史
        const userMessage: ChatMessage = {
          id: generateMessageId(),
          role: 'user',
          content: inputText.trim(),
          timestamp: Date.now(),
          isVoiceMessage: true,
        };
        addChatMessage(userMessage);

        // 2. Step 5.2: Check for visual keywords and trigger scene analysis
        const detectedKeyword = detectVisualKeywords(inputText);

        if (detectedKeyword) {
          console.log(`[HomeScreen] 🎯 Visual keyword detected: "${detectedKeyword}"`);

          // Check if we have a captured frame
          if (lastCapturedFrameRef.current) {
            try {
              console.log('[HomeScreen] 🔍 Starting scene analysis with caching...');

              // Use sceneUnderstanding.analyzeScene to ensure caching
              await sceneUnderstanding.analyzeScene(
                lastCapturedFrameRef.current,
                inputText // Pass user question for context
              );

              // Update userStore with the analyzed scene for AI context
              if (sceneUnderstanding.currentScene) {
                setCurrentScene(sceneUnderstanding.currentScene);
                console.log('[HomeScreen] 📝 Updated userStore.currentScene:', {
                  location: sceneUnderstanding.currentScene.location,
                  objects: sceneUnderstanding.currentScene.objects,
                  timestamp: sceneUnderstanding.currentScene.timestamp,
                });
              } else {
                console.warn('[HomeScreen] ⚠️ No scene data returned from analysis');
              }

              console.log('[HomeScreen] ✅ Scene analysis complete and cached');
            } catch (error) {
              console.error('[HomeScreen] ❌ Scene analysis error:', error);
              setErrorMessage(`场景分析失败: ${error instanceof Error ? error.message : '未知错误'}`);
              setShowErrorToast(true);
            }
          } else {
            console.log('[HomeScreen] ⚠️ Visual keyword detected but no image available');
          }
        }

        // 3. 准备背景故事（如果可用）
        const backgroundStory = backgroundContext
          ? formatStoryForAI(backgroundContext)
          : undefined;

        // 4. 调用 AI 获取回复并播放 TTS
        await sendMessage(inputText, {
          modelType: 'haiku',
          enableTTS: true, // 启用语音播放
          backgroundStory, // 传递背景故事
          sceneContext: sceneUnderstanding.currentScene, // 直接传递场景数据，避免状态更新延迟
        });

        // 注意：状态变化由统一的 useEffect 管理
      } catch (error) {
        console.error('AI flow error:', error);
        // 错误处理，状态会自动回到 idle
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [addChatMessage, sendMessage, backgroundContext, setCurrentScene]
    // Note: sceneUnderstanding excluded to prevent re-render loop
  );

  // 核心语音对话流程（使用 runAIFlow）
  const handleVoiceConversation = useCallback(
    async (userText: string) => {
      await runAIFlow(userText);
    },
    [runAIFlow]
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
        {/* Error Toast */}
        <ErrorToast
          message={errorMessage}
          isVisible={showErrorToast}
          onDismiss={handleDismissError}
          duration={4000}
        />

        <Header
          characterName={selectedCharacter || 'AI伴侣'}
          onGoBack={handleGoBack}
          onGoToChatHistory={handleGoToChatHistory}
          onGoToSceneHistory={handleGoToSceneHistory}
          onGoToEmotionTest={handleGoToEmotionTest}
          onGoToEnvironmentTest={handleGoToEnvironmentTest}
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

        {/* Facial Emotion Detection */}
        <BasicEmotionDetector
          onEmotionDetected={setFacialEmotion}
          isActive={true}
          detectionInterval={3000}
          onFrameCaptured={(frameBase64) => {
            // Step 5.2: Store last captured frame for visual QA
            lastCapturedFrameRef.current = frameBase64;
          }}
          frameCaptureInterval={30000}
        />

        {/* Debug Background Info (only in debug mode) */}
        {isDebugMode() && backgroundContext && (
          <View className='absolute left-0 w-4/5 p-3 rounded-lg top-14 bg-black/70'>
            <Text className='mb-1 text-xs font-bold text-white'>
              背景场景调试信息
            </Text>
            <Text className='text-xs text-white'>
              场景ID: {backgroundContext.scene.id}
            </Text>
            <Text className='text-xs text-white'>
              类型: {backgroundContext.scene.dayType} -{' '}
              {backgroundContext.scene.timePeriod}
            </Text>
            <Text className='text-xs text-white'>
              地点: {backgroundContext.scene.location}
            </Text>
            <Text className='text-xs text-white'>
              天气: {backgroundContext.weather}
            </Text>
            <Text className='text-xs text-white' numberOfLines={2}>
              故事: {backgroundContext.story.substring(0, 60)}...
            </Text>
          </View>
        )}
      </SafeAreaViewRN>
    </ImageBackground>
  );
};

// 带情绪提供器的HomeScreen包装器
const HomeScreen: React.FC<Props> = ({ navigation }) => {
  return (
    <EmotionProvider>
      <HomeScreenContent navigation={navigation} />
    </EmotionProvider>
  );
};

export default HomeScreen;
