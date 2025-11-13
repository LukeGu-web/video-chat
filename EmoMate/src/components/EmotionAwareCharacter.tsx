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
  isTemporaryMotion,
} from '../capabilities/motion/motionMapper';

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
  currentText,
}) => {
  const { combinedEmotion, facialEmotion, textEmotion } = useEmotionContext();
  const { aiStatus } = useAIStatus();
  const lastEmotionRef = useRef<EmotionType>('neutral');
  const [motionSelection, setMotionSelection] =
    useState<MotionSelection | null>(null);
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
      aiThinking: aiStatus === 'Thinking',
    };

    // Use advanced motion mapper
    const selection = selectMotion(context);

    console.log(
      `🎯 [EmotionAwareCharacter] Motion selected: ${selection.motion}`
    );
    console.log(`   📝 Reason: ${selection.reason}`);
    console.log(`   ⭐ Priority: ${selection.priority}`);
    console.log(
      `   🎭 Emotion: ${combinedEmotion} | AI Status: ${aiStatus || 'none'}`
    );

    debugLog('EmotionAwareCharacter', `Motion selection`, {
      context,
      selection,
      aiStatus,
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
      aiThinking: aiStatus === 'Thinking',
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
          debugLog(
            'EmotionAwareCharacter',
            `Returning to Idle after ${selection.motion}`
          );
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
      debugLog(
        'EmotionAwareCharacter',
        `Emotion changed: ${lastEmotionRef.current} -> ${combinedEmotion}`,
        {
          facialEmotion,
          textEmotion,
          aiStatus,
          resultMotion: currentMotion,
          selectionReason: motionSelection?.reason,
        }
      );
      lastEmotionRef.current = combinedEmotion;
    }
  }, [
    combinedEmotion,
    facialEmotion,
    textEmotion,
    aiStatus,
    currentMotion,
    motionSelection,
  ]);

  const handleMotionComplete = useCallback(
    (motion: string, success: boolean) => {
      debugLog(
        'EmotionAwareCharacter',
        `Motion ${motion} completed: ${success ? 'success' : 'failed'}`
      );
      onMotionComplete?.(motion, success);
    },
    [onMotionComplete]
  );

  return (
    <View className={`relative ${className}`}>
      <Live2DCharacter
        status={currentMotion}
        size={size}
        loop={loop}
        onMotionComplete={handleMotionComplete}
      />

      {isDebugMode() && (
        <View className='absolute bottom-24 left-8 bg-black/80 rounded-lg p-2 max-w-[280px]'>
          <Text className='mb-1 text-xs font-bold text-white'>
            Motion Selection
          </Text>
          <View className='gap-0.5'>
            <View className='flex-row items-center'>
              <Text className='w-12 font-mono text-xs text-gray-400 min-w-20'>
                Facial:
              </Text>
              <Text className='font-mono text-xs text-gray-100'>
                {facialEmotion || 'none'}
              </Text>
            </View>
            <View className='flex-row items-center'>
              <Text className='w-12 font-mono text-xs text-gray-400 min-w-20'>
                Text:
              </Text>
              <Text className='font-mono text-xs text-gray-100'>
                {textEmotion || 'none'}
              </Text>
            </View>
            <View className='flex-row items-center'>
              <Text className='w-12 font-mono text-xs text-gray-400 min-w-24'>
                Combined:
              </Text>
              <Text className='font-mono text-xs font-bold text-green-300'>
                {combinedEmotion}
              </Text>
            </View>
            <View className='flex-row items-center'>
              <Text className='w-12 font-mono text-xs text-gray-400 min-w-28'>
                AI Status:
              </Text>
              <Text className='font-mono text-xs text-blue-300'>
                {aiStatus || 'none'}
              </Text>
            </View>
            <View className='flex-row items-center'>
              <Text className='w-12 font-mono text-xs text-gray-400 min-w-16'>
                Motion:
              </Text>
              <Text className='font-mono text-xs font-bold text-yellow-300'>
                {currentMotion}
              </Text>
            </View>
            <View className='flex-row items-center'>
              <Text className='w-12 font-mono text-xs text-gray-400 min-w-24'>
                Priority:
              </Text>
              <Text className='font-mono text-xs text-purple-300'>
                {motionSelection?.priority ?? '-'}
              </Text>
            </View>
            {motionSelection?.reason && (
              <View className='mt-1'>
                <Text className='font-mono text-xs text-gray-400 min-w-16'>
                  Reason:
                </Text>
                <Text className='font-mono text-xs text-gray-100'>
                  {motionSelection.reason}
                </Text>
              </View>
            )}
            <View className='flex-row items-center'>
              <Text className='w-12 font-mono text-xs text-gray-400 min-w-16'>
                Mapping:
              </Text>
              <Text className='font-mono text-xs text-gray-100'>
                {enableEmotionMapping ? 'ON' : 'OFF'}
              </Text>
            </View>
          </View>
        </View>
      )}
    </View>
  );
};
