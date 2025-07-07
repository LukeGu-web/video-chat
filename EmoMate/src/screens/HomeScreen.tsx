import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Pressable, ScrollView } from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { colors, sizes } from '../constants';
import { useUserStore } from '../store';
import { useSpeechToText, useChatAI, PERSONALITY_PROMPTS } from '../utils';

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
  const { selectedCharacter, setSelectedCharacter, addEmotionLog } = useUserStore();
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
    error: aiError,
    sendMessage,
    clearMessages,
    setPersonality,
  } = useChatAI({ personality: PERSONALITY_PROMPTS.gentle });

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

  const handleSendToAI = async () => {
    if (transcript.trim()) {
      await sendMessage(transcript, { modelType: 'haiku' });
      clearTranscript();
    }
  };

  const handleTestAI = () => {
    sendMessage('你好，我今天感到有点焦虑...', { modelType: 'haiku' });
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Home</Text>
      <Text style={styles.subtitle}>Welcome to EmoMate!</Text>
      <Text style={styles.characterText}>
        当前 AI 伴侣: {selectedCharacter || '未选择'}
      </Text>

      {/* Speech Recognition Section */}
      <View style={styles.speechSection}>
        <Text style={styles.sectionTitle}>语音识别</Text>
        
        {/* Debug info */}
        <Text style={styles.debugText}>
          支持状态: {isSupported ? '支持' : '不支持'}
        </Text>
        
        {/* More detailed debug info */}
        <Text style={styles.debugText}>
          错误信息: {error || '无'}
        </Text>
        
        {error && !isSupported && (
          <Text style={styles.errorText}>
            {error}
          </Text>
        )}
        
        {!isSupported && !error && (
          <Text style={styles.errorText}>
            正在检查设备支持...
          </Text>
        )}

        {/* 始终显示按钮用于测试 */}
        <>
          {/* Press to Talk Button */}
          <Pressable
            style={[
              styles.pressToTalkButton,
              isListening && styles.pressToTalkButtonActive,
              !isSupported && styles.pressToTalkButtonDisabled
            ]}
            onPressIn={isSupported ? startListening : undefined}
            onPressOut={isSupported ? stopListening : undefined}
            disabled={!isSupported}
          >
            <Text style={styles.pressToTalkText}>
              {!isSupported ? '🚫 设备不支持' : 
               isListening ? '🎤 Listening...' : '🎙️ 按住说话'}
            </Text>
          </Pressable>

          {/* Listening Status */}
          {isListening && (
            <View style={styles.listeningContainer}>
              <Text style={styles.listeningText}>🔊 正在听您说话...</Text>
            </View>
          )}

          {/* Transcript Display */}
          {transcript && (
            <View style={styles.transcriptContainer}>
              <Text style={styles.transcriptLabel}>识别结果:</Text>
              <Text style={styles.transcriptText}>{transcript}</Text>
              <View style={styles.transcriptButtons}>
                <TouchableOpacity
                  style={styles.clearButton}
                  onPress={handleClearTranscript}
                >
                  <Text style={styles.clearButtonText}>清除</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.sendButton}
                  onPress={handleSendToAI}
                  disabled={isAILoading}
                >
                  <Text style={styles.sendButtonText}>
                    {isAILoading ? '发送中...' : '发送给AI'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Error Display */}
          {error && isSupported && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}
        </>
      </View>

      {/* AI Chat Section */}
      <View style={styles.chatSection}>
        <Text style={styles.sectionTitle}>AI 对话测试</Text>
        
        <TouchableOpacity 
          style={styles.testButton} 
          onPress={handleTestAI}
          disabled={isAILoading}
        >
          <Text style={styles.testButtonText}>
            {isAILoading ? '🤖 AI思考中...' : '🤖 测试AI对话'}
          </Text>
        </TouchableOpacity>

        {/* Messages Display */}
        {messages.length > 0 && (
          <View style={styles.messagesContainer}>
            <Text style={styles.messagesTitle}>对话记录:</Text>
            {messages.slice(-2).map((message) => ( // 只显示最近2条消息
              <View 
                key={message.id} 
                style={[
                  styles.messageContainer,
                  message.role === 'user' ? styles.userMessage : styles.aiMessage
                ]}
              >
                <Text style={styles.messageRole}>
                  {message.role === 'user' ? '👤 你' : '🤖 AI伴侣'}
                </Text>
                <Text style={styles.messageContent}>{message.content}</Text>
              </View>
            ))}
            <TouchableOpacity 
              style={styles.clearChatButton} 
              onPress={clearMessages}
            >
              <Text style={styles.clearChatButtonText}>清空对话</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* AI Error Display */}
        {aiError && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{aiError}</Text>
          </View>
        )}
      </View>

      <TouchableOpacity style={styles.button} onPress={handleGoBack}>
        <Text style={styles.buttonText}>Go Back</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: sizes.padding,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: 16,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: colors.gray,
    marginBottom: 16,
    textAlign: 'center',
  },
  characterText: {
    fontSize: 18,
    color: colors.black,
    marginBottom: 32,
    textAlign: 'center',
    fontWeight: '500',
  },
  speechSection: {
    width: '100%',
    backgroundColor: colors.white,
    borderRadius: sizes.borderRadius,
    padding: sizes.padding,
    marginBottom: 32,
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: 16,
    textAlign: 'center',
  },
  pressToTalkButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 50,
    marginBottom: 16,
    minWidth: 200,
    alignItems: 'center',
  },
  pressToTalkButtonActive: {
    backgroundColor: colors.error,
    transform: [{ scale: 1.05 }],
  },
  pressToTalkText: {
    color: colors.white,
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  listeningContainer: {
    backgroundColor: colors.lightGray,
    padding: 12,
    borderRadius: sizes.borderRadius,
    marginBottom: 16,
  },
  listeningText: {
    fontSize: 16,
    color: colors.primary,
    textAlign: 'center',
    fontWeight: '500',
  },
  transcriptContainer: {
    backgroundColor: colors.lightGray,
    padding: 16,
    borderRadius: sizes.borderRadius,
    marginBottom: 16,
    width: '100%',
  },
  transcriptLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.black,
    marginBottom: 8,
  },
  transcriptText: {
    fontSize: 16,
    color: colors.black,
    marginBottom: 12,
    lineHeight: 24,
  },
  clearButton: {
    backgroundColor: colors.secondary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: sizes.borderRadius,
    alignSelf: 'flex-end',
  },
  clearButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '600',
  },
  errorContainer: {
    backgroundColor: colors.error,
    padding: 12,
    borderRadius: sizes.borderRadius,
    marginBottom: 16,
  },
  errorText: {
    color: colors.white,
    fontSize: 14,
    textAlign: 'center',
  },
  debugText: {
    fontSize: 14,
    color: colors.gray,
    textAlign: 'center',
    marginBottom: 8,
  },
  pressToTalkButtonDisabled: {
    backgroundColor: colors.gray,
    opacity: 0.6,
  },
  transcriptButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  sendButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: sizes.borderRadius,
    flex: 1,
  },
  sendButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  chatSection: {
    width: '100%',
    backgroundColor: colors.white,
    borderRadius: sizes.borderRadius,
    padding: sizes.padding,
    marginBottom: 32,
    alignItems: 'center',
  },
  testButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: sizes.borderRadius,
    marginBottom: 16,
    minWidth: 180,
  },
  testButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  messagesContainer: {
    width: '100%',
    marginTop: 16,
  },
  messagesTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: 12,
  },
  messageContainer: {
    padding: 12,
    borderRadius: sizes.borderRadius,
    marginBottom: 8,
  },
  userMessage: {
    backgroundColor: colors.lightGray,
    alignSelf: 'flex-end',
    maxWidth: '80%',
  },
  aiMessage: {
    backgroundColor: '#E3F2FD',
    alignSelf: 'flex-start',
    maxWidth: '80%',
  },
  messageRole: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 4,
    color: colors.gray,
  },
  messageContent: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.black,
  },
  clearChatButton: {
    backgroundColor: colors.secondary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: sizes.borderRadius,
    alignSelf: 'center',
    marginTop: 12,
  },
  clearChatButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '600',
  },
  button: {
    backgroundColor: colors.secondary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: sizes.borderRadius,
  },
  buttonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default HomeScreen;