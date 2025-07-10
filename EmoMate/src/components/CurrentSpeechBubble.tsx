import React from 'react';
import { View, Text } from 'react-native';

interface CurrentSpeechBubbleProps {
  currentMessage: string;
}

const CurrentSpeechBubble: React.FC<CurrentSpeechBubbleProps> = ({
  currentMessage,
}) => {
  return (
    <View className='justify-center mx-4 my-2'>
      {/* 气泡容器 - 固定高度容器 */}
      {currentMessage && currentMessage.trim() !== '' && (
        <View className='relative max-w-[80%] self-center'>
          {/* 气泡主体 */}
          <View className='justify-center px-4 py-3 bg-blue-100 border-2 border-blue-300 shadow-sm rounded-2xl'>
            <Text className='text-base font-medium leading-relaxed text-center text-blue-800'>
              {currentMessage}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
};

export default CurrentSpeechBubble;
