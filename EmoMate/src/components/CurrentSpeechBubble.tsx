import React from 'react';
import { View, Text } from 'react-native';

interface CurrentSpeechBubbleProps {
  currentMessage: string;
}

const CurrentSpeechBubble: React.FC<CurrentSpeechBubbleProps> = ({
  currentMessage,
}) => {
  console.log('💬 CurrentSpeechBubble 渲染:', { currentMessage });
  
  return (
    <View className="mx-4 my-2 h-24 justify-center">
      {/* 气泡容器 - 固定高度容器 */}
      {currentMessage && currentMessage.trim() !== '' && (
        <View className="relative max-w-[80%] self-center">
          {/* 气泡主体 */}
          <View className="bg-blue-100 rounded-2xl px-4 py-3 shadow-sm min-h-[60px] justify-center border-2 border-blue-300">
            <Text className="text-blue-800 text-base leading-relaxed text-center font-medium">
              {currentMessage}
            </Text>
          </View>
          
          {/* 气泡尾巴 */}
          <View className="absolute -top-2 left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-8 border-r-8 border-b-8 border-l-transparent border-r-transparent border-b-blue-100" />
        </View>
      )}
    </View>
  );
};

export default CurrentSpeechBubble;