import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, sizes } from '../constants';
import { ChatMessage } from '../store/userStore';

interface ChatBubbleProps {
  message: ChatMessage;
}

export const ChatBubble: React.FC<ChatBubbleProps> = ({ message }) => {
  const isUser = message.role === 'user';
  const time = new Date(message.timestamp).toLocaleTimeString('zh-CN', { 
    hour: '2-digit', 
    minute: '2-digit' 
  });

  return (
    <View style={[
      styles.container,
      isUser ? styles.userContainer : styles.aiContainer
    ]}>
      <View style={[
        styles.bubble,
        isUser ? styles.userBubble : styles.aiBubble
      ]}>
        {message.isVoiceMessage && (
          <View style={styles.voiceIndicator}>
            <Text style={styles.voiceIcon}>
              {isUser ? '🎙️' : '🗣️'}
            </Text>
          </View>
        )}
        <Text style={[
          styles.messageText,
          isUser ? styles.userText : styles.aiText
        ]}>
          {message.content}
        </Text>
        <Text style={[
          styles.timeText,
          isUser ? styles.userTimeText : styles.aiTimeText
        ]}>
          {time}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
    paddingHorizontal: sizes.padding,
  },
  userContainer: {
    alignItems: 'flex-end',
  },
  aiContainer: {
    alignItems: 'flex-start',
  },
  bubble: {
    maxWidth: '80%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    position: 'relative',
  },
  userBubble: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 6,
  },
  aiBubble: {
    backgroundColor: colors.white,
    borderBottomLeftRadius: 6,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  voiceIndicator: {
    position: 'absolute',
    top: -8,
    right: 8,
    backgroundColor: colors.background,
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceIcon: {
    fontSize: 12,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  userText: {
    color: colors.white,
  },
  aiText: {
    color: colors.black,
  },
  timeText: {
    fontSize: 12,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  userTimeText: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  aiTimeText: {
    color: colors.gray,
  },
});