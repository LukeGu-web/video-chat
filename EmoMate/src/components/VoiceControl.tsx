import React from 'react';
import { View, Text, TouchableOpacity, Pressable } from 'react-native';

interface VoiceControlProps {
  isListening?: boolean;
  isSupported?: boolean;
  isAILoading?: boolean;
  isSpeaking?: boolean;
  isGenerating?: boolean; // 新增：是否正在生成语音
  error?: string | null;
  transcript?: string;
  onStartListening?: () => void;
  onStopListening?: () => void;
  onStopSpeaking?: () => void;
}

const VoiceControl: React.FC<VoiceControlProps> = ({
  isListening = false,
  isSupported = true,
  isAILoading = false,
  isSpeaking = false,
  isGenerating = false,
  error,
  transcript,
  onStartListening,
  onStopListening,
  onStopSpeaking,
}) => {
  const isDisabled = isAILoading || isSpeaking || isGenerating;

  return (
    <>
      {/* Status Display */}
      <View className='px-4 py-2 border-t border-gray-200 bg-gray-50'>
        {/* TTS Status - 播放状态（有停止按钮） */}
        {isSpeaking && (
          <View className='flex-row items-center justify-between px-2 py-3 mb-2 rounded-lg bg-blue-50'>
            <View className='flex-row items-center'>
              <Text className='mr-2 text-lg'>🗣️</Text>
              <Text className='text-sm font-medium text-blue-700'>
                AI 正在说话...
              </Text>
            </View>
            <TouchableOpacity
              className='px-4 py-2 bg-red-500 rounded-full shadow-sm'
              onPress={onStopSpeaking}
            >
              <Text className='text-sm font-bold text-white'>停止语音</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Transcript Display */}
        {transcript && (
          <View className='py-2'>
            <Text className='text-sm italic text-center text-gray-700'>
              "{transcript}"
            </Text>
          </View>
        )}
      </View>

      {/* Voice Control Button */}
      <View className='px-4 py-6 bg-white border-t border-gray-200'>
        {!isSupported ? (
          <View className='items-center'>
            <Text className='mb-2 text-center text-red-500'>
              设备不支持语音识别功能
            </Text>
            <Text className='text-xs text-center text-gray-500'>
              错误: {error || '检查中...'}
            </Text>
          </View>
        ) : (
          <Pressable
            className={`w-20 h-20 rounded-full items-center justify-center mx-auto ${
              isListening
                ? 'bg-red-500'
                : isDisabled
                ? 'bg-gray-400'
                : 'bg-primary'
            }`}
            onPressIn={onStartListening}
            onPressOut={onStopListening}
            disabled={isDisabled}
          >
            <Text className='mb-1 text-2xl text-white'>
              {isListening ? '🎤' : '🎙️'}
            </Text>
            <Text className='text-xs font-medium text-center text-white'>
              {isListening
                ? '松开结束'
                : isAILoading
                ? 'AI思考中'
                : isGenerating
                ? '生成语音中'
                : isSpeaking
                ? 'AI说话中'
                : '按住说话'}
            </Text>
          </Pressable>
        )}
      </View>
    </>
  );
};

export default VoiceControl;
