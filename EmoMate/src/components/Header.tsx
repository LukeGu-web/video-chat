import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';

interface HeaderProps {
  characterName?: string;
  onGoBack?: () => void;
  onClearChat?: () => void;
}

const Header: React.FC<HeaderProps> = ({
  characterName = 'AI伴侣',
  onGoBack,
  onClearChat
}) => {
  return (
    <View className="flex-row justify-between items-center px-4 py-3 bg-white border-b border-gray-200">
      <TouchableOpacity onPress={onGoBack}>
        <Text className="text-primary font-medium">← 返回</Text>
      </TouchableOpacity>
      <Text className="text-lg font-bold text-black">
        与 {characterName} 对话
      </Text>
      <TouchableOpacity onPress={onClearChat}>
        <Text className="text-red-500 text-sm font-medium">清空</Text>
      </TouchableOpacity>
    </View>
  );
};

export default Header;