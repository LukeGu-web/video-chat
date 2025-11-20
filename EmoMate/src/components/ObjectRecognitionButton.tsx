import React from 'react';
import { Pressable, Text, ActivityIndicator } from 'react-native';

interface ObjectRecognitionButtonProps {
  onRecognize: () => void;
  isRecognizing: boolean;
  disabled?: boolean;
}

// Shared shadow style for consistency with VoiceControl
const BUTTON_SHADOW_STYLE = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.3,
  shadowRadius: 8,
  elevation: 8,
};

/**
 * ObjectRecognitionButton - Floating button for object recognition
 *
 * Features:
 * - Visual feedback during recognition
 * - Loading state with spinner
 * - Unified shadow and styling with VoiceControl
 * - Uses Pressable (consistent with VoiceControl)
 *
 * Note: Position should be controlled by parent container
 */
export const ObjectRecognitionButton: React.FC<ObjectRecognitionButtonProps> = ({
  onRecognize,
  isRecognizing,
  disabled = false,
}) => {
  const isDisabled = isRecognizing || disabled;

  return (
    <Pressable
      onPress={onRecognize}
      disabled={isDisabled}
      className={`w-20 h-20 rounded-full items-center justify-center ${
        isDisabled ? 'bg-gray-400' : 'bg-green-500'
      }`}
      style={BUTTON_SHADOW_STYLE}
    >
      {isRecognizing ? (
        <ActivityIndicator size='small' color='#fff' />
      ) : (
        <Text className='text-3xl'>📷</Text>
      )}
      <Text className='text-xs text-center text-white'>
        {isRecognizing ? '识别中...' : '识别物品'}
      </Text>
    </Pressable>
  );
};
