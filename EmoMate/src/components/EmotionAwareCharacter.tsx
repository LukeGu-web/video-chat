import React, { useEffect, useCallback } from 'react';
import { View } from 'react-native';
import CharacterAvatar from './CharacterAvatar';
import { useAIStatus, useEmotionStore } from '../store';
import { motionCoordinator } from '../capabilities/motion';
import { debugLog } from '../utils/debug';

interface EmotionAwareCharacterProps {
  size?: number;
  className?: string;
  onMotionComplete?: (motion: string, success: boolean) => void;
  enableEmotionMapping?: boolean;
}

export const EmotionAwareCharacter: React.FC<EmotionAwareCharacterProps> = ({
  size = 240,
  className = '',
  onMotionComplete,
  enableEmotionMapping = true,
}) => {
  const facialEmotion = useEmotionStore((state) => state.facialEmotion);
  const { aiStatus } = useAIStatus();

  // Route AI thinking state to coordinator (highest priority signal)
  useEffect(() => {
    if (!enableEmotionMapping) return;
    if (aiStatus === 'Thinking') {
      debugLog('EmotionAwareCharacter', 'AI thinking: true');
      motionCoordinator.onAIThinking(true);
    } else if (aiStatus !== 'Speaking') {
      // When Speaking, coordinator is already in TTS_Speaking (driven by onTTSStart).
      // Calling onAIThinking(false) here would race against that transition.
      debugLog('EmotionAwareCharacter', 'AI thinking: false');
      motionCoordinator.onAIThinking(false);
    }
  }, [aiStatus, enableEmotionMapping]);

  // Route camera facial emotion to coordinator (only acts when idle)
  useEffect(() => {
    if (!enableEmotionMapping) return;
    if (facialEmotion) {
      debugLog('EmotionAwareCharacter', `Camera emotion: ${facialEmotion}`);
      motionCoordinator.onCameraEmotion(facialEmotion);
    }
  }, [facialEmotion, enableEmotionMapping]);

  const handleMotionComplete = useCallback(
    (motion: string, success: boolean) => {
      onMotionComplete?.(motion, success);
    },
    [onMotionComplete],
  );

  return (
    <View className={`relative ${className}`}>
      <CharacterAvatar size={size} onMotionComplete={handleMotionComplete} />
    </View>
  );
};
