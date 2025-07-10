import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';

interface HeaderProps {
  characterName?: string;
  onGoBack?: () => void;
  onSwitchTTS?: () => void;
  onGoToChatHistory?: () => void;
  ttsProvider?: string;
}

const Header: React.FC<HeaderProps> = ({
  characterName = 'AI伴侣',
  onGoBack,
  onSwitchTTS,
  onGoToChatHistory,
  ttsProvider,
}) => {
  return (
    <View className='px-4 py-3 bg-white border-b border-gray-200'>
      <View className='flex-row items-center justify-between'>
        <TouchableOpacity onPress={onGoBack}>
          <Text className='font-medium text-primary'>← 返回</Text>
        </TouchableOpacity>
        {/* <Text className='text-lg font-bold text-black'>
          与 {characterName} 对话
        </Text> */}
        <View className='flex-row items-center'>
          {onGoToChatHistory && (
            <TouchableOpacity onPress={onGoToChatHistory}>
              <Text className='text-sm font-medium text-blue-500'>
                聊天记录
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* TTS Status and Controls */}
      {/* <View className='flex-row items-center justify-between mt-2'>
        <TouchableOpacity
          onPress={onSwitchTTS}
          className='flex-row items-center'
        >
          <Text className='text-xs text-gray-500'>语音引擎:</Text>
          <Text
            className={`text-xs font-medium ml-1 ${
              ttsProvider === 'elevenlabs' ? 'text-green-600' : 'text-blue-600'
            }`}
          >
            {ttsProvider === 'elevenlabs' ? 'ElevenLabs' : 'Expo'}
          </Text>
          <Text className='ml-1 text-xs text-gray-400'>↻</Text>
        </TouchableOpacity>
      </View> */}
    </View>
  );
};

export default Header;
