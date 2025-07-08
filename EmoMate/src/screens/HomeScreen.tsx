import React, { useEffect, useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, Pressable, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StackNavigationProp } from '@react-navigation/stack';
import { useUserStore, ChatMessage } from '../store';
import { useSpeechToText, useChatAI, PERSONALITY_PROMPTS } from '../utils';
import { ChatBubble, ListeningIndicator, TypingIndicator, ErrorToast } from '../components';

type RootStackParamList = {
  Welcome: undefined;
  Home: undefined;
};

type HomeScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  'Home'
>;

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
    clearChatHistory
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
    error: aiError,
    sendMessage,
    clearMessages,
    setPersonality,
    stopSpeaking,
  } = useChatAI({ personality: PERSONALITY_PROMPTS.gentle, enableTTS: true });

  // Error toast state
  const [showErrorToast, setShowErrorToast] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Handle errors
  useEffect(() => {
    if (error || aiError) {
      const message = error || aiError;
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
      emotion: '开心'
    });
  }, [selectedCharacter, setSelectedCharacter, addEmotionLog]);

  const handleGoBack = () => {
    navigation.goBack();
  };

  const handleClearTranscript = () => {
    clearTranscript();
  };

  // 生成唯一消息ID
  const generateMessageId = () => {
    return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  };

  // 核心语音对话流程
  const handleVoiceConversation = useCallback(async (userText: string) => {
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
        enableTTS: true // 启用语音播放
      });

    } catch (error) {
      // Handle voice conversation error silently
    }
  }, [addChatMessage, sendMessage]);

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
        const existsInHistory = chatHistory.some(msg => 
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

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Error Toast */}
      <ErrorToast
        message={errorMessage}
        isVisible={showErrorToast}
        onDismiss={handleDismissError}
        duration={4000}
      />
      
      {/* Header */}
      <View className="flex-row justify-between items-center px-4 py-3 bg-white border-b border-gray-200">
        <TouchableOpacity onPress={handleGoBack}>
          <Text className="text-primary font-medium">← 返回</Text>
        </TouchableOpacity>
        <Text className="text-lg font-bold text-black">
          与 {selectedCharacter || 'AI伴侣'} 对话
        </Text>
        <TouchableOpacity onPress={clearChatHistory}>
          <Text className="text-red-500 text-sm font-medium">清空</Text>
        </TouchableOpacity>
      </View>

      {/* Chat Messages */}
      <View className="flex-1">
        {chatHistory.length === 0 ? (
          <View className="flex-1 justify-center items-center px-8">
            {/* Listening State */}
            {isListening ? (
              <ListeningIndicator isVisible={true} />
            ) : (
              <>
                <Text className="text-xl text-gray-600 text-center mb-4">
                  👋 按住下方按钮开始语音对话
                </Text>
                <Text className="text-sm text-gray-500 text-center">
                  说话后会自动识别并发送给AI，AI也会语音回复
                </Text>
              </>
            )}
          </View>
        ) : (
          <FlatList
            data={chatHistory}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <ChatBubble message={item} />}
            ListFooterComponent={() => (
              <>
                {/* Typing Indicator */}
                {isAILoading && (
                  <TypingIndicator 
                    isVisible={true} 
                    characterName={selectedCharacter || 'AI'}
                  />
                )}
                
                {/* Listening State in Chat */}
                {isListening && (
                  <View className="px-4 py-2">
                    <ListeningIndicator isVisible={true} />
                  </View>
                )}
              </>
            )}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingVertical: 8 }}
          />
        )}
      </View>

      {/* Status Display */}
      <View className="px-4 py-2 bg-gray-50 border-t border-gray-200">
        {/* TTS Status */}
        {isSpeaking && (
          <View className="flex-row items-center justify-between py-2">
            <Text className="text-sm text-gray-600">🗣️ AI 正在说话...</Text>
            <TouchableOpacity 
              className="px-3 py-1 bg-red-500 rounded-full"
              onPress={stopSpeaking}
            >
              <Text className="text-white text-xs font-medium">停止</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Transcript Display */}
        {transcript && (
          <View className="py-2">
            <Text className="text-sm text-gray-700 italic text-center">"{transcript}"</Text>
          </View>
        )}
      </View>

      {/* Voice Control */}
      <View className="px-4 py-6 bg-white border-t border-gray-200">
        {!isSupported ? (
          <View className="items-center">
            <Text className="text-red-500 text-center mb-2">
              设备不支持语音识别功能
            </Text>
            <Text className="text-xs text-gray-500 text-center">
              错误: {error || '检查中...'}
            </Text>
          </View>
        ) : (
          <Pressable
            className={`w-20 h-20 rounded-full items-center justify-center mx-auto ${
              isListening 
                ? 'bg-red-500' 
                : (isAILoading || isSpeaking) 
                  ? 'bg-gray-400' 
                  : 'bg-primary'
            }`}
            onPressIn={startListening}
            onPressOut={stopListening}
            disabled={isAILoading || isSpeaking}
          >
            <Text className="text-white text-2xl mb-1">
              {isListening ? '🎤' : '🎙️'}
            </Text>
            <Text className="text-white text-xs text-center font-medium">
              {isListening ? '松开结束' : 
               isAILoading ? 'AI思考中' :
               isSpeaking ? 'AI说话中' : '按住说话'}
            </Text>
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
};

export default HomeScreen;