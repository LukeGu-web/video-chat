import React, { useEffect, useCallback, useRef, useState } from 'react';
import { View, Text } from 'react-native';
import Live2DCharacter, { HIYORI_MOTIONS } from './Live2DCharacter';
import { useEmotionContext } from './EmotionProvider';
import { EmotionType } from '../types/emotion';
import { useAIStatus, HiyoriMotion } from '../store';
import { debugLog } from '../utils/debug';
import { useMonitorContext } from '../contexts/MonitorContext';
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

  // Monitor context for debug panel
  const { updateEmotionStatus } = useMonitorContext();

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

  // Sync emotion status to monitor context
  useEffect(() => {
    updateEmotionStatus({
      facialEmotion,
      textEmotion,
      combinedEmotion,
      aiStatus,
      selectedMotion: currentMotion,
      motionPriority: motionSelection?.priority || 0,
      motionReason: motionSelection?.reason || '',
      mappingEnabled: enableEmotionMapping,
    });
  }, [
    facialEmotion,
    textEmotion,
    combinedEmotion,
    aiStatus,
    currentMotion,
    motionSelection,
    enableEmotionMapping,
    updateEmotionStatus,
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
    </View>
  );
};
