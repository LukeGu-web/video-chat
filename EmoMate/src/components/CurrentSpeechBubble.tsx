import React from 'react';
import { View, Text } from 'react-native';

interface CurrentSpeechBubbleProps {
  currentMessage: string;
}

const CurrentSpeechBubble: React.FC<CurrentSpeechBubbleProps> = ({
  currentMessage,
}) => {
  // 如果没有消息，不渲染气泡
  if (!currentMessage || currentMessage.trim() === '') {
    return null;
  }

  return (
    <View className="mx-4 my-2">
      {/* 气泡容器 */}
      <View className="relative max-w-[80%] self-center">
        {/* 气泡主体 */}
        <View className="bg-gray-100 rounded-2xl px-4 py-3 shadow-sm">
          <Text className="text-gray-800 text-base leading-relaxed text-center">
            {currentMessage}
          </Text>
        </View>
        
        {/* 气泡尾巴 */}
        <View className="absolute -top-2 left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-8 border-r-8 border-b-8 border-l-transparent border-r-transparent border-b-gray-100" />
      </View>
    </View>
  );
};

export default CurrentSpeechBubble;