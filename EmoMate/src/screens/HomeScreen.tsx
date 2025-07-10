import React, { useEffect, useCallback, useState } from 'react';
import { View, TouchableOpacity, Text } from 'react-native';
import { SafeAreaView as SafeAreaViewRN } from 'react-native-safe-area-context';
import { StackNavigationProp } from '@react-navigation/stack';
import { useUserStore, ChatMessage, useAIStatus } from '../store';
import { useSpeechToText, useChatAI } from '../utils';
import { PERSONALITY_PROMPTS } from '../constants';
import {
  Header,
  VoiceControl,
  ErrorToast,
  LottieTest,
  AnimatedCharacter,
  CurrentSpeechBubble,
} from '../components';

type RootStackParamList = {
  Welcome: undefined;
  Home: undefined;
  ChatHistory: undefined;
};

type HomeScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Home'>;

interface Props {
  navigation: HomeScreenNavigationProp;
}

const HomeScreen: React.FC<Props> = ({ navigation }) => {
  const {
    selectedCharacter,
    setSelectedCharacter,
    addEmotionLog,
    chatHistory,
    addChatMessage,
  } = useUserStore();

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
    currentTTSProvider,
    sendMessage,
    stopSpeaking,
    switchTTSProvider,
    currentSegment,
  } = useChatAI({ personality: PERSONALITY_PROMPTS.gentle, enableTTS: true });

  // Error toast state
  const [showErrorToast, setShowErrorToast] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Test mode state
  const [isTestMode, setIsTestMode] = useState(false);

  // Handle errors
  useEffect(() => {
    if (error || aiError) {
      const message = error || aiError || '';
      setErrorMessage(message);
      setShowErrorToast(true);
    }
  }, [error, aiError]);

  // 统一的 AI 状态管理
  useEffect(() => {
    if (isListening) {
      // 1. 开始语音识别时：listening 状态
      setAIStatus('listening');
    } else if (isGenerating) {
      // 2. 正在生成回复：thinking 状态
      setAIStatus('thinking');
    } else if (isSpeaking) {
      // 3. 正在播放 TTS：speaking 状态
      setAIStatus('speaking');
    } else {
      // 4. 其他情况：idle 状态
      setAIStatus('idle');
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

  const handleGoBack = () => {
    navigation.goBack();
  };

  const handleGoToChatHistory = () => {
    navigation.navigate('ChatHistory');
  };

  const handleSwitchTTS = useCallback(() => {
    const newProvider =
      currentTTSProvider === 'elevenlabs' ? 'expo' : 'elevenlabs';
    switchTTSProvider(newProvider);
  }, [currentTTSProvider, switchTTSProvider]);

  // 生成唯一消息ID
  const generateMessageId = () => {
    return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  };

  // AI 对话流程
  const runAIFlow = useCallback(
    async (inputText: string) => {
      if (!inputText.trim()) return;

      try {
        // 1. 添加用户消息到聊天历史
        const userMessage: ChatMessage = {
          id: generateMessageId(),
          role: 'user',
          content: inputText.trim(),
          timestamp: Date.now(),
          isVoiceMessage: true,
        };
        addChatMessage(userMessage);

        // 2. 调用 AI 获取回复并播放 TTS
        await sendMessage(inputText, {
          modelType: 'haiku',
          enableTTS: true, // 启用语音播放
        });

        // 注意：状态变化由统一的 useEffect 管理
      } catch (error) {
        console.error('AI flow error:', error);
        // 错误处理，状态会自动回到 idle
      }
    },
    [addChatMessage, sendMessage]
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
          <Text className='text-lg font-bold text-gray-800'>
            Lottie 动画测试
          </Text>
          <View className='w-20' />
        </View>

        {/* Lottie Test Component */}
        <LottieTest />
      </SafeAreaViewRN>
    );
  }

  return (
    <SafeAreaViewRN className='flex-1 bg-background'>
      {/* Error Toast */}
      <ErrorToast
        message={errorMessage}
        isVisible={showErrorToast}
        onDismiss={handleDismissError}
        duration={4000}
      />

      {/* Header with Test Mode Button */}
      <View className='bg-white border-b border-gray-200'>
        <Header
          characterName={selectedCharacter || 'AI伴侣'}
          onGoBack={handleGoBack}
          onSwitchTTS={handleSwitchTTS}
          onGoToChatHistory={handleGoToChatHistory}
          ttsProvider={currentTTSProvider}
        />

        {/* Test Mode Button */}
        {/* <View className='flex-row justify-end px-4 pb-3'>
          <TouchableOpacity
            onPress={() => setIsTestMode(true)}
            className='px-3 py-1 bg-purple-500 rounded-full'
          >
            <Text className='text-sm font-medium text-white'>测试动画</Text>
          </TouchableOpacity>
        </View> */}
      </View>

      {/* Main Content Area */}
      <View className='justify-center flex-1'>
        {/* Animated Character */}
        <View className='items-center'>
          <AnimatedCharacter size={280} loop={true} className='shadow-lg' />
        </View>

        {/* Current Speech Bubble - Only show when AI is speaking */}
        {console.log('🔍 Speech Bubble状态:', {
          isSpeaking,
          currentSegment,
          shouldShow: isSpeaking && currentSegment,
        })}
        {isSpeaking && currentSegment && (
          <CurrentSpeechBubble currentMessage={currentSegment} />
        )}
      </View>

      {/* Voice Control */}
      <VoiceControl
        isListening={isListening}
        isSupported={isSupported}
        isAILoading={isAILoading}
        isSpeaking={isSpeaking}
        isGenerating={isGenerating}
        error={error}
        transcript={transcript}
        onStartListening={startListening}
        onStopListening={stopListening}
        onStopSpeaking={stopSpeaking}
      />
    </SafeAreaViewRN>
  );
};

export default HomeScreen;
