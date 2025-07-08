import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';

interface HeaderProps {
  characterName?: string;
  onGoBack?: () => void;
  onClearChat?: () => void;
  onTestTTS?: () => void;
  onSwitchTTS?: () => void;
  ttsProvider?: string;
}

const Header: React.FC<HeaderProps> = ({
  characterName = 'AI伴侣',
  onGoBack,
  onClearChat,
  onTestTTS,
  onSwitchTTS,
  ttsProvider
}) => {
  return (
    <View className="px-4 py-3 bg-white border-b border-gray-200">
      <View className="flex-row justify-between items-center">
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
      
      {/* TTS Status and Controls */}
      <View className="flex-row justify-between items-center mt-2">
        <TouchableOpacity onPress={onSwitchTTS} className="flex-row items-center">
          <Text className="text-xs text-gray-500">
            语音引擎: 
          </Text>
          <Text className={`text-xs font-medium ml-1 ${
            ttsProvider === 'elevenlabs' ? 'text-green-600' : 'text-blue-600'
          }`}>
            {ttsProvider === 'elevenlabs' ? 'ElevenLabs' : 'Expo'}
          </Text>
          <Text className="text-xs text-gray-400 ml-1">↻</Text>
        </TouchableOpacity>
        
        {onTestTTS && (
          <TouchableOpacity onPress={onTestTTS} className="px-2 py-1 bg-blue-100 rounded">
            <Text className="text-blue-600 text-xs">测试语音</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

export default Header;