/**
 * Conversation State Indicator
 * Phase 3 UX Optimization: Real-time visual feedback for conversation state
 *
 * Displays current state of the conversation pipeline:
 * - LISTENING: User is speaking
 * - THINKING: Transition audio playing or AI generating response
 * - GENERATING: Claude AI is generating response (streaming)
 * - SYNTHESIZING: TTS is synthesizing audio
 * - SPEAKING: AI is speaking (playing audio)
 */

import React from 'react';
import { View, Text, Animated } from 'react-native';

export enum ConversationState {
  LISTENING = 'listening',
  THINKING = 'thinking',
  GENERATING = 'generating',
  SYNTHESIZING = 'synthesizing',
  SPEAKING = 'speaking',
  IDLE = 'idle',
}

interface StateConfig {
  icon: string;
  label: string;
  color: string;
  bgColor: string;
}

const STATE_CONFIG: Record<ConversationState, StateConfig> = {
  [ConversationState.LISTENING]: {
    icon: '🎤',
    label: '正在听你说话...',
    color: '#3B82F6', // blue-500
    bgColor: '#DBEAFE', // blue-100
  },
  [ConversationState.THINKING]: {
    icon: '🤔',
    label: '思考中...',
    color: '#8B5CF6', // purple-500
    bgColor: '#EDE9FE', // purple-100
  },
  [ConversationState.GENERATING]: {
    icon: '💭',
    label: '正在回答...',
    color: '#06B6D4', // cyan-500
    bgColor: '#CFFAFE', // cyan-100
  },
  [ConversationState.SYNTHESIZING]: {
    icon: '🎵',
    label: '合成语音...',
    color: '#10B981', // green-500
    bgColor: '#D1FAE5', // green-100
  },
  [ConversationState.SPEAKING]: {
    icon: '🗣️',
    label: '兰兰正在说话',
    color: '#F59E0B', // amber-500
    bgColor: '#FEF3C7', // amber-100
  },
  [ConversationState.IDLE]: {
    icon: '😊',
    label: '等待中...',
    color: '#6B7280', // gray-500
    bgColor: '#F3F4F6', // gray-100
  },
};

interface Props {
  state: ConversationState;
  visible?: boolean;
}

export const ConversationStateIndicator: React.FC<Props> = ({
  state,
  visible = true,
}) => {
  const [pulseAnim] = React.useState(new Animated.Value(1));

  // Pulse animation for active states
  React.useEffect(() => {
    if (
      state !== ConversationState.IDLE &&
      state !== ConversationState.THINKING
    ) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();

      return () => {
        pulse.stop();
        pulseAnim.setValue(1);
      };
    }
  }, [state, pulseAnim]);

  if (!visible || state === ConversationState.IDLE) {
    return null;
  }

  const config = STATE_CONFIG[state];

  return (
    <View className="px-4 py-2">
      <Animated.View
        style={{
          transform: [{ scale: pulseAnim }],
        }}
        className="flex-row items-center rounded-full px-4 py-2 self-center shadow-sm"
        style={{ backgroundColor: config.bgColor }}
      >
        <Text className="text-xl mr-2">{config.icon}</Text>
        <Text
          className="text-sm font-medium"
          style={{ color: config.color }}
        >
          {config.label}
        </Text>
      </Animated.View>
    </View>
  );
};

/**
 * Hook to manage conversation state
 * Automatically determines state based on multiple indicators
 */
export function useConversationState(
  isListening: boolean,
  isGenerating: boolean,
  isSynthesizing: boolean,
  isSpeaking: boolean
): ConversationState {
  // Priority order: LISTENING > GENERATING > SYNTHESIZING > SPEAKING > IDLE
  if (isListening) {
    return ConversationState.LISTENING;
  }

  if (isGenerating) {
    return ConversationState.GENERATING;
  }

  if (isSynthesizing) {
    return ConversationState.SYNTHESIZING;
  }

  if (isSpeaking) {
    return ConversationState.SPEAKING;
  }

  return ConversationState.IDLE;
}

/**
 * Mini version for compact display
 */
export const MiniStateIndicator: React.FC<Props> = ({ state, visible = true }) => {
  if (!visible || state === ConversationState.IDLE) {
    return null;
  }

  const config = STATE_CONFIG[state];

  return (
    <View
      className="flex-row items-center rounded-full px-3 py-1"
      style={{ backgroundColor: config.bgColor }}
    >
      <Text className="text-base mr-1">{config.icon}</Text>
      <View
        className="w-2 h-2 rounded-full"
        style={{ backgroundColor: config.color }}
      />
    </View>
  );
};
