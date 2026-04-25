import React, { useEffect, useCallback, useRef, useState } from 'react';
import { View } from 'react-native';
import CharacterAvatar from './CharacterAvatar';
import { EmotionType } from '../types/emotion';
import { useAIStatus, AvatarMotion, useEmotionStore, useMonitorStore } from '../store';
import { debugLog } from '../utils/debug';
import {
  selectMotion,
  ConversationContext,
  MotionSelection,
} from '../capabilities/motion/motionMapper';

interface EmotionAwareCharacterProps {
  size?: number;
  loop?: boolean;
  className?: string;
  onMotionComplete?: (motion: string, success: boolean) => void;
  enableEmotionMapping?: boolean;
  currentText?: string;
}

export const EmotionAwareCharacter: React.FC<EmotionAwareCharacterProps> = ({
  size = 240,
  loop = true,
  className = '',
  onMotionComplete,
  enableEmotionMapping = true,
  currentText,
}) => {
  const combinedEmotion = useEmotionStore((state) => state.combinedEmotion);
  const facialEmotion = useEmotionStore((state) => state.facialEmotion);
  const textEmotion = useEmotionStore((state) => state.textEmotion);
  const { aiStatus } = useAIStatus();
  const lastEmotionRef = useRef<EmotionType>('neutral');
  const [motionSelection, setMotionSelection] = useState<MotionSelection | null>(null);
  const returnToIdleTimerRef = useRef<NodeJS.Timeout | null>(null);

  const updateEmotionStatus = useMonitorStore((state) => state.updateEmotionStatus);

  // Derive currentMotion from state so the return-to-idle timer can trigger a
  // re-render and actually change what CharacterAvatar receives.
  const currentMotion: AvatarMotion = motionSelection?.motion ?? (aiStatus || 'Idle');

  // Recompute motion selection whenever any relevant signal changes.
  useEffect(() => {
    if (!enableEmotionMapping) {
      setMotionSelection(null);
      return;
    }

    // Suppress facial-emotion-driven motions when not in active conversation so
    // the character stays in Idle while the user is quietly watching.
    const isInActiveConversation =
      (aiStatus !== null && aiStatus !== 'Idle') || textEmotion !== null;
    const effectiveEmotion: typeof combinedEmotion = isInActiveConversation
      ? combinedEmotion
      : 'neutral';

    const context: ConversationContext = {
      text: currentText || '',
      emotion: effectiveEmotion,
      aiSpeaking: aiStatus === 'Speaking',
      aiThinking: aiStatus === 'Thinking',
    };

    const selection = selectMotion(context);

    debugLog('EmotionAwareCharacter', `Motion selected: ${selection.motion}`, {
      reason: selection.reason,
      priority: selection.priority,
      emotion: combinedEmotion,
      aiStatus,
    });

    setMotionSelection(selection);

    if (selection.returnToIdle && selection.duration) {
      if (returnToIdleTimerRef.current) {
        clearTimeout(returnToIdleTimerRef.current);
      }

      returnToIdleTimerRef.current = setTimeout(() => {
        if (!aiStatus || aiStatus === 'Idle') {
          debugLog('EmotionAwareCharacter', `Returning to Idle after ${selection.motion}`);
          setMotionSelection({
            motion: 'Idle',
            priority: 0,
            reason: `Return to idle after ${selection.motion}`,
          });
        }
      }, selection.duration);
    }

    return () => {
      if (returnToIdleTimerRef.current) {
        clearTimeout(returnToIdleTimerRef.current);
      }
    };
  }, [combinedEmotion, textEmotion, aiStatus, enableEmotionMapping, currentText]);

  // Debug-only: log when the combined emotion changes.
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
  }, [combinedEmotion, facialEmotion, textEmotion, aiStatus, currentMotion, motionSelection]);

  // Sync emotion status to debug monitor.
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
      debugLog('EmotionAwareCharacter', `Motion ${motion} completed: ${success ? 'success' : 'failed'}`);
      onMotionComplete?.(motion, success);
    },
    [onMotionComplete]
  );

  return (
    <View className={`relative ${className}`}>
      <CharacterAvatar
        size={size}
        onMotionComplete={handleMotionComplete}
      />
    </View>
  );
};
