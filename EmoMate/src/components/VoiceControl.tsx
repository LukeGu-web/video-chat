import React from 'react';
import { View, Text, TouchableOpacity, Pressable } from 'react-native';

interface VoiceControlProps {
  isListening?: boolean;
  isSupported?: boolean;
  isAILoading?: boolean;
  isSpeaking?: boolean;
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
  error,
  transcript,
  onStartListening,
  onStopListening,
  onStopSpeaking
}) => {
  const isDisabled = isAILoading || isSpeaking;

  return (
    <>
      {/* Status Display */}
      <View className="px-4 py-2 bg-gray-50 border-t border-gray-200">
        {/* TTS Status */}
        {isSpeaking && (
          <View className="flex-row items-center justify-between py-2">
            <Text className="text-sm text-gray-600">🗣️ AI 正在说话...</Text>
            <TouchableOpacity 
              className="px-3 py-1 bg-red-500 rounded-full"
              onPress={onStopSpeaking}
            >
              <Text className="text-white text-xs font-medium">停止</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Transcript Display */}
        {transcript && (
          <View className="py-2">
            <Text className="text-sm text-gray-700 italic text-center">"{transcript}"</Text>
          </View>
        )}
      </View>

      {/* Voice Control Button */}
      <View className="px-4 py-6 bg-white border-t border-gray-200">
        {!isSupported ? (
          <View className="items-center">
            <Text className="text-red-500 text-center mb-2">
              设备不支持语音识别功能
            </Text>
            <Text className="text-xs text-gray-500 text-center">
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
            <Text className="text-white text-2xl mb-1">
              {isListening ? '🎤' : '🎙️'}
            </Text>
            <Text className="text-white text-xs text-center font-medium">
              {isListening ? '松开结束' : 
               isAILoading ? 'AI思考中' :
               isSpeaking ? 'AI说话中' : '按住说话'}
            </Text>
          </Pressable>
        )}
      </View>
    </>
  );
};

export default VoiceControl;