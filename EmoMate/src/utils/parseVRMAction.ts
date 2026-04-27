import { VRMAMotionName } from '../types/vrm';

export type ActionIntent =
  | { type: 'emotion'; emotion: string }
  | { type: 'motion';  motion: VRMAMotionName };

export interface ParseActionResult {
  intent: ActionIntent | null;
  cleanText: string;
  hasPartialTag: boolean;
}

const VALID_EMOTIONS = new Set<string>([
  'joy', 'laugh', 'surprise', 'shy', 'sad', 'excited', 'thinking', 'trust',
]);

const VALID_MOTIONS = new Set<string>([
  'full_pose', 'greeting', 'v_sign', 'photo_pose', 'spin', 'model_pose', 'crouch',
]);

export function parseVRMAction(text: string): ParseActionResult {
  let intent: ActionIntent | null = null;

  const completeRegex = /<action>([\s\S]*?)<\/action>/g;
  let match: RegExpExecArray | null;
  while ((match = completeRegex.exec(text)) !== null) {
    try {
      const payload = JSON.parse(match[1].trim()) as Record<string, unknown>;
      if (typeof payload.emotion === 'string' && VALID_EMOTIONS.has(payload.emotion)) {
        intent = { type: 'emotion', emotion: payload.emotion };
      } else if (typeof payload.motion === 'string' && VALID_MOTIONS.has(payload.motion)) {
        intent = { type: 'motion', motion: payload.motion as VRMAMotionName };
      }
    } catch {
      // malformed JSON — discard tag but still strip it from text
    }
  }
  let cleanText = text.replace(/<action>[\s\S]*?<\/action>/g, '').trim();

  let hasPartialTag = false;
  const partialStart = cleanText.lastIndexOf('<action>');
  if (partialStart !== -1) {
    hasPartialTag = true;
    cleanText = cleanText.slice(0, partialStart).trim();
  }

  return { intent, cleanText, hasPartialTag };
}
