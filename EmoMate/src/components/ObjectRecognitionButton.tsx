import React from 'react';
import { View, TouchableOpacity, Text, ActivityIndicator } from 'react-native';

interface ObjectRecognitionButtonProps {
  onRecognize: () => void;
  isRecognizing: boolean;
  disabled?: boolean;
}

/**
 * ObjectRecognitionButton - Floating button for object recognition
 *
 * Features:
 * - Visual feedback during recognition
 * - Loading state with spinner
 * - Shadow and elevation styling
 */
export const ObjectRecognitionButton: React.FC<ObjectRecognitionButtonProps> = ({
  onRecognize,
  isRecognizing,
  disabled = false,
}) => {
  const isDisabled = isRecognizing || disabled;

  return (
    <View className='absolute px-4 left-8 bottom-8'>
      <TouchableOpacity
        onPress={onRecognize}
        disabled={isDisabled}
        className={`w-20 h-20 rounded-full items-center justify-center shadow-lg ${
          isDisabled ? 'bg-gray-400' : 'bg-green-500'
        }`}
        style={{
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
          elevation: 8,
        }}
      >
        {isRecognizing ? (
          <ActivityIndicator size='small' color='#fff' />
        ) : (
          <Text className='text-3xl'>📷</Text>
        )}
        <Text className='text-xs text-center text-white'>
          {isRecognizing ? '识别中...' : '识别物品'}
        </Text>
      </TouchableOpacity>
    </View>
  );
};
