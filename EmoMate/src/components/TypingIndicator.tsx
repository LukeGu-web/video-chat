import React from 'react';
import { View, Text } from 'react-native';
import LoadingDots from './LoadingDots';

interface TypingIndicatorProps {
  isVisible?: boolean;
  characterName?: string;
}

const TypingIndicator: React.FC<TypingIndicatorProps> = ({ 
  isVisible = true,
  characterName = 'AI'
}) => {
  if (!isVisible) return null;

  return (
    <View className="px-4 py-2">
      <View className="flex-row justify-start">
        <View className="max-w-[80%] px-4 py-3 bg-gray-200 rounded-2xl rounded-bl-sm">
          <View className="flex-row items-center space-x-2">
            <Text className="text-gray-600 text-sm">{characterName} is typing</Text>
            <LoadingDots size="small" color="#6B7280" />
          </View>
        </View>
      </View>
    </View>
  );
};

export default TypingIndicator;