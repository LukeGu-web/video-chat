import React, { useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Pressable, ScrollView, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StackNavigationProp } from '@react-navigation/stack';
import { colors, sizes } from '../constants';
import { useUserStore, ChatMessage } from '../store';
import { useSpeechToText, useChatAI, PERSONALITY_PROMPTS } from '../utils';
import { ChatBubble } from '../components';

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

  useEffect(() => {
    console.log('Current selectedCharacter:', selectedCharacter);
    
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
      console.error('Voice conversation error:', error);
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
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleGoBack}>
          <Text style={styles.backButtonText}>← 返回</Text>
        </TouchableOpacity>
        <Text style={styles.title}>
          与 {selectedCharacter || 'AI伴侣'} 对话
        </Text>
        <TouchableOpacity style={styles.clearButton} onPress={clearChatHistory}>
          <Text style={styles.clearButtonText}>清空</Text>
        </TouchableOpacity>
      </View>

      {/* Chat Messages */}
      <View style={styles.chatContainer}>
        {chatHistory.length === 0 ? (
          <View style={styles.emptyChatContainer}>
            <Text style={styles.emptyChatText}>
              👋 按住下方按钮开始语音对话
            </Text>
            <Text style={styles.emptyChatSubtext}>
              说话后会自动识别并发送给AI，AI也会语音回复
            </Text>
          </View>
        ) : (
          <FlatList
            data={chatHistory}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <ChatBubble message={item} />}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.chatList}
          />
        )}
      </View>

      {/* Status Display */}
      <View style={styles.statusContainer}>
        {/* AI Status */}
        {isAILoading && (
          <View style={styles.statusItem}>
            <Text style={styles.statusText}>🤖 AI 正在思考...</Text>
          </View>
        )}
        
        {/* TTS Status */}
        {isSpeaking && (
          <View style={styles.statusItem}>
            <Text style={styles.statusText}>🗣️ AI 正在说话...</Text>
            <TouchableOpacity style={styles.stopButton} onPress={stopSpeaking}>
              <Text style={styles.stopButtonText}>停止</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Speech Recognition Status */}
        {isListening && (
          <View style={styles.statusItem}>
            <Text style={styles.statusText}>🎙️ 正在听您说话...</Text>
          </View>
        )}

        {/* Transcript Display */}
        {transcript && (
          <View style={styles.transcriptContainer}>
            <Text style={styles.transcriptText}>"{transcript}"</Text>
          </View>
        )}
      </View>

      {/* Voice Control */}
      <View style={styles.voiceControlContainer}>
        {!isSupported ? (
          <View style={styles.unsupportedContainer}>
            <Text style={styles.unsupportedText}>
              设备不支持语音识别功能
            </Text>
            <Text style={styles.debugText}>
              错误: {error || '检查中...'}
            </Text>
          </View>
        ) : (
          <Pressable
            style={[
              styles.voiceButton,
              isListening && styles.voiceButtonActive,
              (isAILoading || isSpeaking) && styles.voiceButtonDisabled
            ]}
            onPressIn={startListening}
            onPressOut={stopListening}
            disabled={isAILoading || isSpeaking}
          >
            <Text style={styles.voiceButtonText}>
              {isListening ? '🎤' : '🎙️'}
            </Text>
            <Text style={styles.voiceButtonLabel}>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: sizes.padding,
    paddingVertical: 12,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.lightGray,
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: '500',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.black,
    flex: 1,
    textAlign: 'center',
  },
  clearButton: {
    padding: 8,
  },
  clearButtonText: {
    fontSize: 14,
    color: colors.error,
    fontWeight: '500',
  },
  chatContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  emptyChatContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: sizes.padding * 2,
  },
  emptyChatText: {
    fontSize: 18,
    color: colors.gray,
    textAlign: 'center',
    marginBottom: 8,
    fontWeight: '500',
  },
  emptyChatSubtext: {
    fontSize: 14,
    color: colors.gray,
    textAlign: 'center',
    lineHeight: 20,
  },
  chatList: {
    paddingVertical: 16,
  },
  statusContainer: {
    backgroundColor: colors.white,
    paddingHorizontal: sizes.padding,
    paddingVertical: 8,
    minHeight: 60,
    justifyContent: 'center',
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  statusText: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: '500',
    flex: 1,
  },
  stopButton: {
    backgroundColor: colors.error,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: sizes.borderRadius,
  },
  stopButtonText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '600',
  },
  transcriptContainer: {
    backgroundColor: colors.lightGray,
    padding: 12,
    borderRadius: sizes.borderRadius,
    marginVertical: 8,
  },
  transcriptText: {
    fontSize: 16,
    color: colors.black,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  voiceControlContainer: {
    backgroundColor: colors.white,
    paddingHorizontal: sizes.padding,
    paddingVertical: 24,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.lightGray,
  },
  unsupportedContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  unsupportedText: {
    fontSize: 16,
    color: colors.error,
    textAlign: 'center',
    marginBottom: 8,
  },
  debugText: {
    fontSize: 12,
    color: colors.gray,
    textAlign: 'center',
  },
  voiceButton: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  voiceButtonActive: {
    backgroundColor: colors.error,
    transform: [{ scale: 1.1 }],
  },
  voiceButtonDisabled: {
    backgroundColor: colors.gray,
    opacity: 0.6,
  },
  voiceButtonText: {
    fontSize: 32,
    marginBottom: 4,
  },
  voiceButtonLabel: {
    fontSize: 12,
    color: colors.white,
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default HomeScreen;