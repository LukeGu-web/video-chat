import React from 'react';
import { View, Text } from 'react-native';
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
    <View className={`my-1 px-4 ${isUser ? 'items-end' : 'items-start'}`}>
      <View className={`max-w-[80%] px-4 py-3 rounded-bubble relative ${
        isUser 
          ? 'bg-primary rounded-br-bubble-sm' 
          : 'bg-white rounded-bl-bubble-sm shadow-chat'
      }`}>
        {message.isVoiceMessage && (
          <View className="absolute -top-2 right-2 bg-background rounded-full w-6 h-6 items-center justify-center">
            <Text className="text-xs">
              {isUser ? '🎙️' : '🗣️'}
            </Text>
          </View>
        )}
        <Text className={`text-base leading-5 ${
          isUser ? 'text-white' : 'text-black'
        }`}>
          {message.content}
        </Text>
        <Text className={`text-xs mt-1 self-end ${
          isUser ? 'text-white opacity-70' : 'text-gray-500'
        }`}>
          {time}
        </Text>
      </View>
    </View>
  );
};