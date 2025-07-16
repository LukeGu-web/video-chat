import React, { useEffect, useCallback, useRef } from 'react';
import { View, Text } from 'react-native';
import Live2DCharacter, { HIYORI_MOTIONS, HiyoriMotion } from './Live2DCharacter';
import { useEmotionContext } from './EmotionProvider';
import { EmotionType } from '../types/emotion';
import { useAIStatus } from '../store';
import { isDebugMode, debugLog } from '../utils/debug';

interface EmotionAwareCharacterProps {
  size?: number;
  loop?: boolean;
  className?: string;
  onMotionComplete?: (motion: string, success: boolean) => void;
  enableEmotionMapping?: boolean;
}

// Map emotions to Hiyori motions
const emotionToMotionMap: Record<EmotionType, HiyoriMotion> = {
  happy: 'Happy',
  sad: 'Sleepy', // Use Sleepy for sad emotion
  angry: 'Surprised', // Use Surprised for angry (best available option)
  surprised: 'Surprised',
  neutral: 'Idle'
};

export const EmotionAwareCharacter: React.FC<EmotionAwareCharacterProps> = ({
  size = 240,
  loop = true,
  className = '',
  onMotionComplete,
  enableEmotionMapping = true
}) => {
  const { combinedEmotion, facialEmotion, textEmotion } = useEmotionContext();
  const { aiStatus } = useAIStatus();
  const lastEmotionRef = useRef<EmotionType>('neutral');

  // Determine the motion to play based on emotion and AI status
  const determineMotion = useCallback((): HiyoriMotion => {
    if (!enableEmotionMapping) {
      return aiStatus || 'Idle';
    }

    // Priority order: AI status > combined emotion
    if (aiStatus && aiStatus !== 'Idle') {
      return aiStatus;
    }

    // Use emotion-based motion
    const emotionMotion = emotionToMotionMap[combinedEmotion];
    debugLog('EmotionAwareCharacter', `Mapping emotion ${combinedEmotion} to motion ${emotionMotion}`);
    
    return emotionMotion;
  }, [combinedEmotion, aiStatus, enableEmotionMapping]);

  const currentMotion = determineMotion();

  // Handle emotion changes
  useEffect(() => {
    if (combinedEmotion !== lastEmotionRef.current) {
      debugLog('EmotionAwareCharacter', `Emotion changed: ${lastEmotionRef.current} -> ${combinedEmotion}`, {
        facialEmotion,
        textEmotion,
        aiStatus,
        resultMotion: currentMotion
      });
      lastEmotionRef.current = combinedEmotion;
    }
  }, [combinedEmotion, facialEmotion, textEmotion, aiStatus, currentMotion]);

  const handleMotionComplete = useCallback((motion: string, success: boolean) => {
    debugLog('EmotionAwareCharacter', `Motion ${motion} completed: ${success ? 'success' : 'failed'}`);
    onMotionComplete?.(motion, success);
  }, [onMotionComplete]);

  return (
    <View className={`relative ${className}`}>
      <Live2DCharacter
        status={currentMotion}
        size={size}
        loop={loop}
        onMotionComplete={handleMotionComplete}
      />
      
      {isDebugMode() && (
        <View className="absolute bottom-2 left-2 bg-black/80 rounded-md p-2">
          <Text className="text-white text-xs font-bold mb-1">Emotion State</Text>
          <View className="gap-0.5">
            <View className="flex-row items-center">
              <Text className="text-gray-400 text-xs font-mono w-12">Facial:</Text>
              <Text className="text-gray-100 text-xs font-mono">{facialEmotion || 'none'}</Text>
            </View>
            <View className="flex-row items-center">
              <Text className="text-gray-400 text-xs font-mono w-12">Text:</Text>
              <Text className="text-gray-100 text-xs font-mono">{textEmotion || 'none'}</Text>
            </View>
            <View className="flex-row items-center">
              <Text className="text-gray-400 text-xs font-mono w-12">Combined:</Text>
              <Text className="text-green-300 text-xs font-mono font-bold">{combinedEmotion}</Text>
            </View>
            <View className="flex-row items-center">
              <Text className="text-gray-400 text-xs font-mono w-12">AI Status:</Text>
              <Text className="text-blue-300 text-xs font-mono">{aiStatus || 'none'}</Text>
            </View>
            <View className="flex-row items-center">
              <Text className="text-gray-400 text-xs font-mono w-12">Motion:</Text>
              <Text className="text-yellow-300 text-xs font-mono font-bold">{currentMotion}</Text>
            </View>
            <View className="flex-row items-center">
              <Text className="text-gray-400 text-xs font-mono w-12">Mapping:</Text>
              <Text className="text-gray-100 text-xs font-mono">{enableEmotionMapping ? 'ON' : 'OFF'}</Text>
            </View>
          </View>
        </View>
      )}
    </View>
  );
};