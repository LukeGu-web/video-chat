import React from 'react';
import { View, Text, TouchableOpacity, Pressable } from 'react-native';

interface VoiceControlProps {
  isListening?: boolean;
  isSupported?: boolean;
  isAILoading?: boolean;
  isSpeaking?: boolean;
  isGenerating?: boolean; // 新增：是否正在生成语音
  error?: string | null;
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
  onStartListening,
  onStopListening,
  onStopSpeaking,
}) => {
  // Phase 3 Fix: Allow stopping when speaking, only disable when loading/generating but not speaking
  const isDisabled = (isAILoading || isGenerating) && !isSpeaking;

  return (
    <>
      {/* Voice Control Button */}
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
              : isSpeaking
              ? 'bg-red-500'
              : isDisabled
              ? 'bg-gray-400'
              : 'bg-primary'
          }`}
          onPressIn={isSpeaking ? undefined : onStartListening}
          onPressOut={isSpeaking ? undefined : onStopListening}
          onPress={isSpeaking ? onStopSpeaking : undefined}
          disabled={isDisabled}
        >
          <Text className='mb-1 text-2xl text-white'>
            {isListening ? '🎤' : isSpeaking ? '⏹️' : '🎙️'}
          </Text>
          <Text className='text-xs font-medium text-center text-white'>
            {isListening
              ? '松开结束'
              : isSpeaking
              ? '点击停止'
              : isAILoading
              ? '发送中'
              : isGenerating
              ? '思考中'
              : '按住说话'}
          </Text>
        </Pressable>
      )}
    </>
  );
};

export default VoiceControl;
