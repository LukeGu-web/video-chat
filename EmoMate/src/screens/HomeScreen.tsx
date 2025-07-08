import React, { useEffect, useCallback, useState } from 'react';
import { View, TouchableOpacity, Text } from 'react-native';
import { SafeAreaView as SafeAreaViewRN } from 'react-native-safe-area-context';
import { StackNavigationProp } from '@react-navigation/stack';
import { useUserStore, ChatMessage } from '../store';
import { useSpeechToText, useChatAI } from '../utils';
import { PERSONALITY_PROMPTS } from '../constants';
import { Header, ChatList, VoiceControl, ErrorToast, LottieTest } from '../components';

type RootStackParamList = {
  Welcome: undefined;
  Home: undefined;
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
    clearChatHistory,
  } = useUserStore();
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
    clearMessages,
    setPersonality,
    stopSpeaking,
    switchTTSProvider,
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

  const handleClearTranscript = () => {
    clearTranscript();
  };

  const handleTestTTS = useCallback(async () => {
    try {
      await sendMessage('你好，这是一个语音测试', {
        enableTTS: true,
        modelType: 'haiku'
      });
    } catch (error) {
      console.error('TTS test failed:', error);
    }
  }, [sendMessage]);

  const handleSwitchTTS = useCallback(() => {
    const newProvider = currentTTSProvider === 'elevenlabs' ? 'expo' : 'elevenlabs';
    switchTTSProvider(newProvider);
  }, [currentTTSProvider, switchTTSProvider]);

  // 生成唯一消息ID
  const generateMessageId = () => {
    return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  };

  // 核心语音对话流程
  const handleVoiceConversation = useCallback(
    async (userText: string) => {
      if (!userText.trim()) return;

      try {
        // 1. 添加用户消息到聊天历史
        const userMessage: ChatMessage = {
          id: generateMessageId(),
          role: 'user',
          content: userText.trim(),
          timestamp: Date.now(),
          isVoiceMessage: true, // 标记为语音消息
        };
        addChatMessage(userMessage);

        // 2. 调用 AI 获取回复
        await sendMessage(userText, {
          modelType: 'haiku',
          enableTTS: true, // 启用语音播放
        });
      } catch (error) {
        // Handle voice conversation error silently
      }
    },
    [addChatMessage, sendMessage]
  );

  // 语音识别完成后的处理
  useEffect(() => {
    if (transcript && !isListening) {
      // 语音识别完成且有文本时，自动发送给AI
      handleVoiceConversation(transcript);
      clearTranscript();
    }
  }, [transcript, isListening, handleVoiceConversation, clearTranscript]);

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
            <Text className='text-white font-medium'>返回聊天</Text>
          </TouchableOpacity>
          <Text className='text-lg font-bold text-gray-800'>Lottie 动画测试</Text>
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
          onClearChat={clearChatHistory}
          onTestTTS={handleTestTTS}
          onSwitchTTS={handleSwitchTTS}
          ttsProvider={currentTTSProvider}
        />
        
        {/* Test Mode Toggle */}
        <View className='px-4 pb-3'>
          <TouchableOpacity
            onPress={() => setIsTestMode(true)}
            className='self-end px-3 py-1 bg-purple-500 rounded-full'
          >
            <Text className='text-white text-sm font-medium'>测试动画</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Chat List */}
      <ChatList
        messages={chatHistory}
        isLoading={isAILoading}
        isListening={isListening}
        characterName={selectedCharacter || 'AI'}
        showTyping={true}
        showListening={true}
      />

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
