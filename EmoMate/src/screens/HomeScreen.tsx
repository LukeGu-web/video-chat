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
import {
  useSceneUnderstanding,
  detectVisualKeywords,
  detectObjectKeywords,
  formatObjectRecognitionForAI,
} from '../capabilities/vision/environment/useSceneUnderstanding';
import { useObjectRecognition } from '../capabilities/vision/environment/useObjectRecognition';
import { PERSONALITY_PROMPTS, getClaudeApiKey } from '../constants';
import {
  Header,
  VoiceControl,
  Toast,
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
      // Step 5.2: Store last captured frame for visual QA and scene understanding
      const frameSize = Math.round((frameBase64.length * 0.75) / 1024);
      console.log('[HomeScreen] 📷 Frame captured from camera:', {
        frameSizeKB: frameSize,
        timestamp: new Date(timestamp).toISOString(),
        timestampMs: timestamp,
      });
      lastCapturedFrameRef.current = frameBase64;
    },
    []
  );

  // Debug: Log API key once on mount
  useEffect(() => {
    console.log('[HomeScreen] 🔑 API Key status:', {
      hasApiKey: !!apiKey,
      keyLength: apiKey?.length || 0,
      keyPreview: apiKey ? `${apiKey.substring(0, 10)}...` : 'undefined',
    });
  }, []); // Only log once

  // Debug: Log scene understanding state (throttled)
  const lastLogTime = useRef(0);
  useEffect(() => {
    const now = Date.now();
    if (now - lastLogTime.current < 5000) return; // Throttle to once per 5 seconds
    lastLogTime.current = now;

    console.log('[HomeScreen] 🔍 Scene Understanding State:', {
      isAnalyzing: sceneUnderstanding.isAnalyzing,
      hasCurrentScene: !!sceneUnderstanding.currentScene,
      currentLocation: sceneUnderstanding.currentScene?.location,
      totalAPICalls: sceneUnderstanding.totalAPICalls,
      error: sceneUnderstanding.error,
      timerEnabled: sceneUnderstanding.timerState.enabled,
      nextCaptureIn: sceneUnderstanding.timerState.nextCaptureIn,
      nextAnalysisIn: sceneUnderstanding.timerState.nextAnalysisIn,
    });
  }, [
    sceneUnderstanding.isAnalyzing,
    sceneUnderstanding.currentScene,
    sceneUnderstanding.error,
    sceneUnderstanding.timerState,
  ]);

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

  // Step 5.3: Background pause - Stop scene detection when app goes to background
  useEffect(() => {
    const subscription = AppState.addEventListener(
      'change',
      (nextAppState: AppStateStatus) => {
        if (nextAppState === 'active') {
          console.log('[HomeScreen] 📱 App is active - starting scene timer');
          sceneUnderstanding.startTimer();
        } else if (
          nextAppState === 'background' ||
          nextAppState === 'inactive'
        ) {
          console.log(
            '[HomeScreen] 📴 App is background/inactive - stopping scene timer'
          );
          sceneUnderstanding.stopTimer();
        }
      }
    );

    // Start timer if app is currently active
    if (AppState.currentState === 'active') {
      console.log(
        '[HomeScreen] 📱 Initial state: App is active - starting scene timer'
      );
      sceneUnderstanding.startTimer();
    }

    return () => {
      subscription.remove();
      sceneUnderstanding.stopTimer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency - only run once on mount

  // Register photo capture callback for scene understanding timer
  useEffect(() => {
    console.log('[HomeScreen] 🔧 Registering photo capture callback...');
    sceneUnderstanding.setPhotoCaptureCallback(async () => {
      console.log('[HomeScreen] 📸 Scene timer requesting photo capture');
      const hasFrame = !!lastCapturedFrameRef.current;
      const frameSize = lastCapturedFrameRef.current
        ? Math.round((lastCapturedFrameRef.current.length * 0.75) / 1024)
        : 0;

      console.log('[HomeScreen] 📊 Frame status:', {
        hasFrame,
        frameSizeKB: frameSize,
      });

      if (lastCapturedFrameRef.current) {
        console.log(
          '[HomeScreen] ✅ Returning captured frame for scene analysis'
        );
        return lastCapturedFrameRef.current;
      } else {
        console.warn(
          '[HomeScreen] ⚠️ No captured frame available for scene analysis'
        );
        return null;
      }
    });
    console.log(
      '[HomeScreen] ✅ Photo capture callback registered for scene understanding'
    );
  }, [sceneUnderstanding]);

  // Monitor scene updates and sync to userStore
  useEffect(() => {
    const current = sceneUnderstanding.currentScene;
    if (current) {
      setCurrentScene(current);
      console.log('[HomeScreen] 📝 Auto-updated scene from timer:', {
        location: current.location,
        objects: current.objects.slice(0, 3),
        confidence: current.confidence,
        timestamp: new Date(current.timestamp).toLocaleTimeString(),
      });
    }
  }, [sceneUnderstanding.currentScene, setCurrentScene]);

  // Initial scene detection on app startup
  useEffect(() => {
    const performInitialSceneDetection = async () => {
      console.log(
        '[HomeScreen] 🚀 App startup - checking for initial scene detection'
      );

      // Check if we have a valid cached scene
      const cached = sceneUnderstanding.currentScene;
      const hasValidScene =
        cached &&
        cached.timestamp &&
        Date.now() - cached.timestamp < 30 * 60 * 1000; // 30 minutes

      if (hasValidScene && cached) {
        console.log(
          '[HomeScreen] ✅ Valid scene cache found, skipping initial detection:',
          {
            location: cached.location,
            age:
              Math.floor((Date.now() - cached.timestamp) / 60000) + ' minutes',
          }
        );
        return;
      }

      console.log(
        '[HomeScreen] 🔍 No valid scene cache, waiting for camera frame...'
      );

      // Poll for camera frame availability (check every 2 seconds, max 30 seconds)
      let attempts = 0;
      const maxAttempts = 15; // 15 attempts * 2 seconds = 30 seconds max wait

      const checkFrameInterval = setInterval(async () => {
        attempts++;

        if (lastCapturedFrameRef.current) {
          console.log(
            '[HomeScreen] 📸 Camera frame available, performing initial scene detection...'
          );
          clearInterval(checkFrameInterval);

          try {
            await sceneUnderstanding.analyzeScene(
              lastCapturedFrameRef.current,
              undefined // No user question (manual trigger)
            );
            console.log(
              '[HomeScreen] ✅ Initial scene detection completed successfully'
            );
          } catch (error) {
            console.error(
              '[HomeScreen] ❌ Initial scene detection failed:',
              error
            );
          }
        } else if (attempts >= maxAttempts) {
          console.warn(
            '[HomeScreen] ⚠️ Timeout waiting for camera frame, will wait for next timer cycle'
          );
          clearInterval(checkFrameInterval);
        } else {
          console.log(
            `[HomeScreen] ⏳ Waiting for camera frame... (attempt ${attempts}/${maxAttempts})`
          );
        }
      }, 2000); // Check every 2 seconds
    };

    performInitialSceneDetection();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

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
      console.log('[HomeScreen] ⚠️ No captured frame available');
      setToastMessage('请等待摄像头捕获画面');
      setToastType('error');
      setShowToast(true);
      return;
    }

    if (isRecognizing || objectRecognition.isLoading) {
      console.log('[HomeScreen] ⚠️ Recognition already in progress');
      return;
    }

    setIsRecognizing(true);
    console.log('[HomeScreen] 📸 Starting object recognition...');

    try {
      const response = await objectRecognition.recognizeObject(
        lastCapturedFrameRef.current,
        '识别这个物品'
      );

      if (response.success) {
        console.log('[HomeScreen] ✅ Object recognized:', {
          name: response.object.objectName,
          category: response.object.category,
        });

        // Show success message (no navigation, just save and notify)
        setToastMessage(`识别成功: ${response.object.objectName}`);
        setToastType('success');
        setShowToast(true);

        // Result is automatically saved by useObjectRecognition hook
        // User can now ask AI about this object in conversation
      } else {
        console.error('[HomeScreen] ❌ Recognition failed:', response.error);
        setToastMessage(response.error || '识别失败，请重试');
        setToastType('error');
        setShowToast(true);
      }
    } catch (error) {
      console.error('[HomeScreen] ❌ Recognition error:', error);
      setToastMessage('识别过程中发生错误');
      setToastType('error');
      setShowToast(true);
    } finally {
      setIsRecognizing(false);
    }
  };

  // Manual scene analysis test
  const handleManualSceneTest = useCallback(async () => {
    console.log('[HomeScreen] 🧪 Manual scene test triggered');
    console.log('[HomeScreen] 📊 Current state:', {
      hasApiKey: !!apiKey,
      hasFrame: !!lastCapturedFrameRef.current,
      frameSize: lastCapturedFrameRef.current
        ? Math.round((lastCapturedFrameRef.current.length * 0.75) / 1024)
        : 0,
      isAnalyzing: sceneUnderstanding.isAnalyzing,
    });

    if (!apiKey) {
      console.error('[HomeScreen] ❌ No API Key configured!');
      setToastMessage('API Key 未配置，请检查 .env 文件');
      setToastType('error');
      setShowToast(true);
      return;
    }

    if (!lastCapturedFrameRef.current) {
      console.warn('[HomeScreen] ⚠️ No frame captured yet, waiting...');
      setToastMessage('摄像头还未捕获帧，请稍候再试');
      setToastType('error');
      setShowToast(true);
      return;
    }

    try {
      console.log('[HomeScreen] 🚀 Starting manual scene analysis...');
      await sceneUnderstanding.analyzeScene(
        lastCapturedFrameRef.current,
        '手动测试场景分析'
      );
      console.log('[HomeScreen] ✅ Manual scene analysis completed');
    } catch (error) {
      console.error('[HomeScreen] ❌ Manual scene analysis failed:', error);
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

        // 2. Check for object recognition keywords first (higher priority)
        let objectContext = '';
        const objectKeyword = detectObjectKeywords(inputText);

        if (objectKeyword) {
          console.log(
            `[HomeScreen] 🎯 Object recognition keyword detected: "${objectKeyword}"`
          );

          // Check if we have a captured frame
          if (lastCapturedFrameRef.current) {
            try {
              console.log('[HomeScreen] 📸 Starting object recognition...');

              // Trigger object recognition
              const recognitionResponse =
                await objectRecognition.recognizeObject(
                  lastCapturedFrameRef.current,
                  inputText // Pass user's original question
                );

              if (recognitionResponse.success) {
                // Format object recognition result as context
                objectContext = formatObjectRecognitionForAI(
                  recognitionResponse.object
                );
                console.log('[HomeScreen] ✅ Object recognition complete:', {
                  name: recognitionResponse.object.objectName,
                  category: recognitionResponse.object.category,
                  contextLength: objectContext.length,
                });
              } else {
                console.error(
                  '[HomeScreen] ❌ Object recognition failed:',
                  recognitionResponse.error
                );
                setToastMessage(recognitionResponse.error || '物品识别失败');
                setToastType('error');
                setShowToast(true);
              }
            } catch (error) {
              console.error('[HomeScreen] ❌ Object recognition error:', error);
              setToastMessage(
                `物品识别失败: ${
                  error instanceof Error ? error.message : '未知错误'
                }`
              );
              setToastType('error');
              setShowToast(true);
            }
          } else {
            console.log(
              '[HomeScreen] ⚠️ Object keyword detected but no image available'
            );
          }
        }

        // 3. If no object keyword, check for scene keywords and trigger scene analysis
        const detectedKeyword = !objectKeyword
          ? detectVisualKeywords(inputText)
          : null;

        if (detectedKeyword) {
          console.log(
            `[HomeScreen] 🎯 Visual keyword detected: "${detectedKeyword}"`
          );

          // Check if we have a captured frame
          if (lastCapturedFrameRef.current) {
            try {
              console.log(
                '[HomeScreen] 🔍 Starting scene analysis with caching...'
              );

              // Use sceneUnderstanding.analyzeScene to ensure caching
              await sceneUnderstanding.analyzeScene(
                lastCapturedFrameRef.current,
                inputText // Pass user question for context
              );

              // Update userStore with the analyzed scene for AI context
              const analyzedScene = sceneUnderstanding.currentScene;
              if (analyzedScene) {
                setCurrentScene(analyzedScene);
                console.log('[HomeScreen] 📝 Updated userStore.currentScene:', {
                  location: analyzedScene.location,
                  objects: analyzedScene.objects,
                  timestamp: analyzedScene.timestamp,
                });
              } else {
                console.warn(
                  '[HomeScreen] ⚠️ No scene data returned from analysis'
                );
              }

              console.log('[HomeScreen] ✅ Scene analysis complete and cached');
            } catch (error) {
              console.error('[HomeScreen] ❌ Scene analysis error:', error);
              setToastMessage(
                `场景分析失败: ${
                  error instanceof Error ? error.message : '未知错误'
                }`
              );
              setToastType('error');
              setShowToast(true);
            }
          } else {
            console.log(
              '[HomeScreen] ⚠️ Visual keyword detected but no image available'
            );
          }
        }

        // 4. 准备背景故事和物品识别上下文（如果可用）
        let combinedContext = '';

        // Add background story if available
        if (backgroundContext) {
          combinedContext += formatStoryForAI(backgroundContext);
        }

        // Add object recognition context if triggered by keyword
        if (objectContext) {
          if (combinedContext) {
            combinedContext += '\n\n';
          }
          combinedContext += objectContext;
        } else {
          // Check if there's a recent object recognition record (within 5 minutes)
          // This allows user to manually recognize an object, then ask AI about it
          const recentRecords = objectRecognition.records;
          if (recentRecords.length > 0) {
            const latestRecord = recentRecords[0]; // Already sorted newest first
            const recordAge = Date.now() - latestRecord.createdAt;
            const fiveMinutesInMs = 5 * 60 * 1000;

            if (recordAge < fiveMinutesInMs) {
              console.log(
                '[HomeScreen] 📦 Using recent object recognition as context:',
                {
                  name: latestRecord.data.objectName,
                  ageSeconds: Math.round(recordAge / 1000),
                }
              );

              if (combinedContext) {
                combinedContext += '\n\n';
              }
              combinedContext += '【最近识别的物品】\n';
              combinedContext += formatObjectRecognitionForAI(
                latestRecord.data
              );
            }
          }
        }

        // 5. 调用 AI 获取回复并播放 TTS
        await sendMessage(inputText, {
          modelType: 'haiku',
          enableTTS: true, // 启用语音播放
          backgroundStory: combinedContext || undefined, // 传递合并后的上下文（背景故事 + 物品识别）
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
        <BasicEmotionDetector
          onEmotionDetected={setFacialEmotion}
          isActive={true}
          detectionInterval={3000}
          onFrameCaptured={handleFrameCaptured}
          frameCaptureInterval={5000} // 5 seconds - faster initial capture for scene understanding
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

        {/* Debug Scene Understanding Test Button (only in debug mode) */}
        {isDebugMode() && (
          <View className='absolute right-0 p-3 rounded-lg top-80 bg-black/70'>
            <Text className='mb-2 text-xs font-bold text-white'>
              场景理解调试
            </Text>
            <TouchableOpacity
              onPress={handleManualSceneTest}
              className='px-3 py-2 mb-1 bg-blue-600 rounded'
              disabled={sceneUnderstanding.isAnalyzing}
            >
              <Text className='text-xs font-semibold text-white'>
                {sceneUnderstanding.isAnalyzing
                  ? '分析中...'
                  : '手动测试场景分析'}
              </Text>
            </TouchableOpacity>
            <Text className='mt-1 text-xs text-white'>
              API调用: {sceneUnderstanding.totalAPICalls}
            </Text>
            <Text className='text-xs text-white'>
              当前场景: {sceneUnderstanding.currentScene?.location || '无'}
            </Text>
            <Text className='text-xs text-white'>
              定时器: {sceneUnderstanding.timerState.enabled ? '开启' : '关闭'}
            </Text>
            <Text className='text-xs text-white'>
              下次拍照:{' '}
              {Math.floor(sceneUnderstanding.timerState.nextCaptureIn / 1000)}s
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
