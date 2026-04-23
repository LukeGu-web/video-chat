/**
 * Motion Mapper - Context-Aware Avatar Motion Selection
 *
 * Features:
 * - Context-aware motion selection based on conversation content
 * - Emotion-based motion mapping with fine-grained control
 * - AI status integration (speaking, thinking, etc.)
 * - Motion priority and transition management
 */

import { EmotionType } from '../../types/emotion';
import { AvatarMotion } from '../../store';
import { debugLog } from '../../utils/debug';

// ==================== Type Definitions ====================

export interface ConversationContext {
  text?: string;              // Current message text
  emotion?: EmotionType;      // Detected emotion
  isGreeting?: boolean;       // Is this a greeting?
  isQuestion?: boolean;       // Is this a question?
  isEncouragement?: boolean;  // Is this encouragement/praise?
  isCelebration?: boolean;    // Is this celebrating something?
  isEmpathy?: boolean;        // Is this showing empathy/concern?
  aiSpeaking?: boolean;       // Is AI currently speaking?
  aiThinking?: boolean;       // Is AI thinking/processing?
}

export interface MotionSelection {
  motion: AvatarMotion;
  priority: number;           // Higher = more important
  reason: string;             // Why this motion was selected
  duration?: number;          // Suggested duration (ms)
  returnToIdle?: boolean;     // Should return to Idle after?
}

// ==================== Motion Priorities ====================

enum MotionPriority {
  IDLE = 0,           // Default idle state
  EMOTION = 1,        // Basic emotion-based motion
  CONTEXT = 2,        // Context-aware motion (greeting, question, etc.)
  AI_STATUS = 3,      // AI status (speaking, thinking)
  SPECIAL = 4,        // Special events (celebration, etc.)
}

// ==================== Emotion to Motion Mapping ====================

/**
 * Enhanced emotion mapping with Plutchik's 8 basic emotions
 */
const emotionMotionMap: Record<EmotionType, AvatarMotion> = {
  joy: 'Happy',                 // Joy → Happy
  sadness: 'Sleepy',            // Sadness → Sleepy
  anger: 'Surprised',           // Anger → Surprised (no angry motion available)
  fear: 'Shy',                  // Fear → Shy
  surprise: 'Surprised',        // Surprise → Surprised
  disgust: 'Thinking',          // Disgust → Thinking (contemplative)
  trust: 'Happy',               // Trust → Happy (positive emotion)
  anticipation: 'Excited',      // Anticipation → Excited
  neutral: 'Idle'               // Neutral → Idle
};

/**
 * Context-specific motion overrides for emotions
 */
const contextualEmotionMotions: Partial<Record<EmotionType, Partial<Record<string, AvatarMotion>>>> = {
  joy: {
    celebration: 'Dance',      // Celebrating → Dance
    laugh: 'Laugh',           // Laughing → Laugh
    greeting: 'Wave',          // Happy greeting → Wave
    excited: 'Excited',        // Very happy → Excited
  },
  trust: {
    greeting: 'Wave',          // Trust greeting → Wave
    speaking: 'Speaking',      // Trust speaking → Speaking
  },
  neutral: {
    thinking: 'Thinking',      // Neutral + thinking → Thinking
    speaking: 'Speaking',      // Neutral + speaking → Speaking
    greeting: 'Wave',          // Neutral greeting → Wave
  },
  surprise: {
    shy: 'Shy',               // Surprised + shy context → Shy
  },
  anticipation: {
    greeting: 'Wave',          // Anticipation greeting → Wave
  }
};

// ==================== Text Pattern Matching ====================

// Boolean context keys that can be set to true
type BooleanContextKeys = 'isGreeting' | 'isQuestion' | 'isEncouragement' | 'isCelebration' | 'isEmpathy';

interface TextPattern {
  pattern: RegExp;
  contextKey: BooleanContextKeys;
  priority: MotionPriority;
}

/**
 * Text patterns for context detection
 */
const textPatterns: TextPattern[] = [
  // Greetings
  { pattern: /^(你好|hi|hello|嗨|哈喽|早上好|晚上好|下午好)/i, contextKey: 'isGreeting', priority: MotionPriority.CONTEXT },
  { pattern: /(再见|拜拜|bye|goodbye)/i, contextKey: 'isGreeting', priority: MotionPriority.CONTEXT },

  // Questions
  { pattern: /[?？]|吗$|呢$|怎么|为什么|什么|哪里|如何/i, contextKey: 'isQuestion', priority: MotionPriority.CONTEXT },

  // Encouragement/Praise
  { pattern: /(好棒|厉害|真棒|太好了|加油|干得好|well done|great|awesome)/i, contextKey: 'isEncouragement', priority: MotionPriority.SPECIAL },

  // Celebration
  { pattern: /(庆祝|成功了|完成了|太棒了|耶|万岁|celebrate)/i, contextKey: 'isCelebration', priority: MotionPriority.SPECIAL },

  // Empathy/Concern
  { pattern: /(没事吧|怎么了|担心|难过|伤心|别哭|安慰|加油)/i, contextKey: 'isEmpathy', priority: MotionPriority.CONTEXT },
];

// ==================== Context Analysis ====================

/**
 * Analyze conversation text to extract context
 */
export function analyzeConversationContext(
  text: string,
  emotion: EmotionType,
  aiSpeaking: boolean = false,
  aiThinking: boolean = false
): ConversationContext {
  const context: ConversationContext = {
    text,
    emotion,
    aiSpeaking,
    aiThinking
  };

  // Match text patterns
  for (const { pattern, contextKey } of textPatterns) {
    if (pattern.test(text)) {
      context[contextKey] = true;
      debugLog('MotionMapper', `Context detected: ${contextKey}`, { text, pattern: pattern.source });
    }
  }

  return context;
}

// ==================== Motion Selection ====================

/**
 * Select the most appropriate motion based on context and emotion
 */
export function selectMotion(context: ConversationContext): MotionSelection {
  let selectedMotion: AvatarMotion = 'Idle';
  let priority = MotionPriority.IDLE;
  let reason = 'Default idle state';
  let duration: number | undefined;
  let returnToIdle = false;

  // Priority 1: AI Status (highest priority)
  if (context.aiSpeaking) {
    selectedMotion = 'Speaking';
    priority = MotionPriority.AI_STATUS;
    reason = 'AI is speaking';
  } else if (context.aiThinking) {
    selectedMotion = 'Thinking';
    priority = MotionPriority.AI_STATUS;
    reason = 'AI is thinking';
    duration = 3000;
    returnToIdle = true;
  }

  // Priority 2: Special Events
  if (context.isCelebration && priority < MotionPriority.SPECIAL) {
    selectedMotion = 'Dance';
    priority = MotionPriority.SPECIAL;
    reason = 'Celebration detected';
    duration = 5000;
    returnToIdle = true;
  }

  if (context.isEncouragement && priority < MotionPriority.SPECIAL) {
    if (context.emotion === 'joy') {
      selectedMotion = 'Excited';
    } else {
      selectedMotion = 'Happy';
    }
    priority = MotionPriority.SPECIAL;
    reason = 'Encouragement/praise detected';
    duration = 3000;
    returnToIdle = true;
  }

  // Priority 3: Context-specific
  if (context.isGreeting && priority < MotionPriority.CONTEXT) {
    selectedMotion = 'Wave';
    priority = MotionPriority.CONTEXT;
    reason = 'Greeting detected';
    duration = 3000;
    returnToIdle = true;
  }

  if (context.isEmpathy && priority < MotionPriority.CONTEXT) {
    if (context.emotion === 'sadness') {
      selectedMotion = 'Sleepy';  // Empathetic sad response
    } else {
      selectedMotion = 'Thinking'; // Thoughtful empathy
    }
    priority = MotionPriority.CONTEXT;
    reason = 'Empathy/concern detected';
    duration = 4000;
    returnToIdle = true;
  }

  if (context.isQuestion && priority < MotionPriority.CONTEXT) {
    selectedMotion = 'Thinking';
    priority = MotionPriority.CONTEXT;
    reason = 'Question detected';
    duration = 2000;
    returnToIdle = true;
  }

  // Priority 4: Emotion-based (with contextual overrides)
  if (context.emotion && priority < MotionPriority.EMOTION) {
    // Check for contextual emotion motions
    const emotionOverrides = contextualEmotionMotions[context.emotion];
    let contextMotion: AvatarMotion | undefined;

    if (emotionOverrides) {
      // Check specific contexts
      if (context.isCelebration && emotionOverrides.celebration) {
        contextMotion = emotionOverrides.celebration;
      } else if (context.text?.includes('哈哈') || context.text?.includes('笑') && emotionOverrides.laugh) {
        contextMotion = emotionOverrides.laugh;
      } else if (context.isGreeting && emotionOverrides.greeting) {
        contextMotion = emotionOverrides.greeting;
      } else if ((context.text?.includes('兴奋') || context.text?.includes('太棒')) && emotionOverrides.excited) {
        contextMotion = emotionOverrides.excited;
      } else if (context.aiThinking && emotionOverrides.thinking) {
        contextMotion = emotionOverrides.thinking;
      } else if (context.aiSpeaking && emotionOverrides.speaking) {
        contextMotion = emotionOverrides.speaking;
      }
    }

    if (contextMotion) {
      selectedMotion = contextMotion;
      reason = `Contextual emotion motion: ${context.emotion} + context`;
    } else {
      selectedMotion = emotionMotionMap[context.emotion];
      reason = `Emotion-based motion: ${context.emotion}`;
    }
    priority = MotionPriority.EMOTION;
    returnToIdle = selectedMotion !== 'Idle';
  }

  const selection: MotionSelection = {
    motion: selectedMotion,
    priority,
    reason,
    duration,
    returnToIdle
  };

  debugLog('MotionMapper', `Selected motion: ${selectedMotion}`, {
    context,
    selection
  });

  return selection;
}

// ==================== Quick Selection Functions ====================

/**
 * Quick motion selection from text and emotion
 */
export function selectMotionFromText(
  text: string,
  emotion: EmotionType = 'neutral',
  aiSpeaking: boolean = false,
  aiThinking: boolean = false
): MotionSelection {
  const context = analyzeConversationContext(text, emotion, aiSpeaking, aiThinking);
  return selectMotion(context);
}

/**
 * Map emotion directly to motion (simple mapping without context)
 */
export function emotionToAvatarMotion(emotion: EmotionType): AvatarMotion {
  return emotionMotionMap[emotion];
}

// ==================== Motion Transition Management ====================

export interface MotionTransition {
  from: AvatarMotion;
  to: AvatarMotion;
  delay: number;  // Delay before transition (ms)
}

/**
 * Calculate smooth transition between motions
 */
export function calculateMotionTransition(
  currentMotion: AvatarMotion,
  targetMotion: AvatarMotion
): MotionTransition {
  // Immediate transitions (no delay)
  const immediateTransitions = [
    'Speaking',  // Switch to speaking immediately
  ];

  // Long transitions (need more delay)
  const longTransitions = [
    'Dance',     // Dance should complete before transitioning
    'Excited',   // Excited motion should complete
  ];

  let delay = 500; // Default delay

  if (immediateTransitions.includes(targetMotion)) {
    delay = 0;
  } else if (longTransitions.includes(currentMotion)) {
    delay = 3000; // Wait for current motion to complete
  } else if (currentMotion === targetMotion) {
    delay = 0; // No transition needed
  }

  return {
    from: currentMotion,
    to: targetMotion,
    delay
  };
}

// ==================== Motion Utilities ====================

/**
 * Check if motion is a temporary action (should return to Idle)
 */
export function isTemporaryMotion(motion: AvatarMotion): boolean {
  const temporaryMotions: AvatarMotion[] = [
    'Wave',
    'Dance',
    'Laugh',
    'Excited',
    'Surprised',
    'Thinking'
  ];

  return temporaryMotions.includes(motion);
}

/**
 * Get suggested duration for motion
 */
export function getMotionDuration(motion: AvatarMotion): number {
  const durations: Partial<Record<AvatarMotion, number>> = {
    'Wave': 3000,
    'Dance': 5000,
    'Laugh': 3000,
    'Excited': 3000,
    'Surprised': 2000,
    'Thinking': 3000,
    'Speaking': 0,  // Duration depends on speech
    'Happy': 4000,
    'Shy': 3000,
    'Sleepy': 5000,
    'Idle': 0  // Continuous
  };

  return durations[motion] || 3000;
}

/**
 * Get all available avatar motions
 */
export function getAvailableMotions(): AvatarMotion[] {
  return [
    'Idle',
    'Speaking',
    'Thinking',
    'Happy',
    'Surprised',
    'Shy',
    'Wave',
    'Dance',
    'Laugh',
    'Excited',
    'Sleepy'
  ];
}

// ==================== VRM Motion Commands ====================

import { VRMMotionResult } from '../../types/vrm';

/**
 * Maps a Plutchik emotion to VRM bridge commands.
 * Returns an expression command + optional preset command.
 */
export function emotionToVRMCommands(
  emotion: EmotionType,
  intensity: number = 1.0
): VRMMotionResult {
  const scale = Math.max(0.1, Math.min(1.0, intensity));

  const map: Record<EmotionType, VRMMotionResult> = {
    joy: {
      expressionCommand: {
        type: 'setExpression',
        data: { blendShapes: { joy: 0.8 * scale }, duration: 0.5, holdDuration: 3 },
      },
      presetCommand: { type: 'playPreset', data: { name: 'happy' } },
    },
    sadness: {
      expressionCommand: {
        type: 'setExpression',
        data: { blendShapes: { sorrow: 0.7 * scale }, duration: 0.8, holdDuration: 3 },
      },
    },
    anger: {
      expressionCommand: {
        type: 'setExpression',
        data: { blendShapes: { angry: 0.6 * scale }, duration: 0.5, holdDuration: 3 },
      },
    },
    fear: {
      expressionCommand: {
        type: 'setExpression',
        data: { blendShapes: { surprised: 0.5 * scale, sorrow: 0.3 * scale }, duration: 0.5, holdDuration: 3 },
      },
      presetCommand: { type: 'playPreset', data: { name: 'shy' } },
    },
    surprise: {
      expressionCommand: {
        type: 'setExpression',
        data: { blendShapes: { surprised: 0.9 * scale }, duration: 0.3, holdDuration: 2 },
      },
      presetCommand: { type: 'playPreset', data: { name: 'surprised' } },
    },
    disgust: {
      expressionCommand: {
        type: 'setExpression',
        data: { blendShapes: { angry: 0.4 * scale, sorrow: 0.2 * scale }, duration: 0.5, holdDuration: 3 },
      },
    },
    trust: {
      expressionCommand: {
        type: 'setExpression',
        data: { blendShapes: { joy: 0.4 * scale, fun: 0.3 * scale }, duration: 0.5, holdDuration: 3 },
      },
    },
    anticipation: {
      expressionCommand: {
        type: 'setExpression',
        data: { blendShapes: { fun: 0.5 * scale }, duration: 0.5, holdDuration: 3 },
      },
      presetCommand: { type: 'playPreset', data: { name: 'thinking' } },
    },
    neutral: {
      expressionCommand: {
        type: 'setExpression',
        data: { blendShapes: { neutral: 0 }, duration: 0.5 },
      },
    },
  };

  return map[emotion] ?? map.neutral;
}
