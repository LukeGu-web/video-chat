import React, { useEffect, useCallback, useRef, useState } from 'react';
import { View, Text } from 'react-native';
import Live2DCharacter, { HIYORI_MOTIONS } from './Live2DCharacter';
import { useEmotionContext } from './EmotionProvider';
import { EmotionType } from '../types/emotion';
import { useAIStatus, HiyoriMotion } from '../store';
import { isDebugMode, debugLog } from '../utils/debug';
import {
  selectMotion,
  analyzeConversationContext,
  ConversationContext,
  MotionSelection,
  calculateMotionTransition,
  isTemporaryMotion
} from '../utils/motionMapper';

interface EmotionAwareCharacterProps {
  size?: number;
  loop?: boolean;
  className?: string;
  onMotionComplete?: (motion: string, success: boolean) => void;
  enableEmotionMapping?: boolean;
  currentText?: string; // Current AI response text for context analysis
}

export const EmotionAwareCharacter: React.FC<EmotionAwareCharacterProps> = ({
  size = 240,
  loop = true,
  className = '',
  onMotionComplete,
  enableEmotionMapping = true,
  currentText
}) => {
  const { combinedEmotion, facialEmotion, textEmotion } = useEmotionContext();
  const { aiStatus } = useAIStatus();
  const lastEmotionRef = useRef<EmotionType>('neutral');
  const [motionSelection, setMotionSelection] = useState<MotionSelection | null>(null);
  const returnToIdleTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Determine the motion to play based on emotion, AI status, and context
  const currentMotion = React.useMemo((): HiyoriMotion => {
    if (!enableEmotionMapping) {
      return aiStatus || 'Idle';
    }

    // Build conversation context
    const context: ConversationContext = {
      text: currentText || '',
      emotion: combinedEmotion,
      aiSpeaking: aiStatus === 'Speaking',
      aiThinking: aiStatus === 'Thinking'
    };

    // Use advanced motion mapper
    const selection = selectMotion(context);

    debugLog('EmotionAwareCharacter', `Motion selection`, {
      context,
      selection,
      aiStatus
    });

    return selection.motion;
  }, [combinedEmotion, aiStatus, enableEmotionMapping, currentText]);

  // Update motion selection state in useEffect to avoid render loop
  useEffect(() => {
    if (!enableEmotionMapping) {
      setMotionSelection(null);
      return;
    }

    const context: ConversationContext = {
      text: currentText || '',
      emotion: combinedEmotion,
      aiSpeaking: aiStatus === 'Speaking',
      aiThinking: aiStatus === 'Thinking'
    };

    const selection = selectMotion(context);
    setMotionSelection(selection);

    // Handle return to Idle after temporary motions
    if (selection.returnToIdle && selection.duration) {
      if (returnToIdleTimerRef.current) {
        clearTimeout(returnToIdleTimerRef.current);
      }

      returnToIdleTimerRef.current = setTimeout(() => {
        // Only return to Idle if no new AI status
        if (!aiStatus || aiStatus === 'Idle') {
          debugLog('EmotionAwareCharacter', `Returning to Idle after ${selection.motion}`);
          // Don't set motion selection here, just let it naturally go to Idle
        }
      }, selection.duration);
    }

    return () => {
      if (returnToIdleTimerRef.current) {
        clearTimeout(returnToIdleTimerRef.current);
      }
    };
  }, [combinedEmotion, aiStatus, enableEmotionMapping, currentText]);

  // Handle emotion changes
  useEffect(() => {
    if (combinedEmotion !== lastEmotionRef.current) {
      debugLog('EmotionAwareCharacter', `Emotion changed: ${lastEmotionRef.current} -> ${combinedEmotion}`, {
        facialEmotion,
        textEmotion,
        aiStatus,
        resultMotion: currentMotion,
        selectionReason: motionSelection?.reason
      });
      lastEmotionRef.current = combinedEmotion;
    }
  }, [combinedEmotion, facialEmotion, textEmotion, aiStatus, currentMotion, motionSelection]);

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
        <View className="absolute bottom-2 left-2 bg-black/80 rounded-md p-2 max-w-[240px]">
          <Text className="text-white text-xs font-bold mb-1">Motion Selection</Text>
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
              <Text className="text-gray-400 text-xs font-mono w-12">Priority:</Text>
              <Text className="text-purple-300 text-xs font-mono">{motionSelection?.priority ?? '-'}</Text>
            </View>
            {motionSelection?.reason && (
              <View className="mt-1">
                <Text className="text-gray-400 text-xs font-mono">Reason:</Text>
                <Text className="text-gray-100 text-xs font-mono">{motionSelection.reason}</Text>
              </View>
            )}
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