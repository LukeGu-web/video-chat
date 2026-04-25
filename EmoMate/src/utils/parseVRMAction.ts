export interface ActionIntent {
  emotion: string; // "joy" | "laugh" | "surprise" | "shy" | "sad" | "excited" | "thinking" | "trust"
}

export interface ParseActionResult {
  intent: ActionIntent | null;
  cleanText: string;
  hasPartialTag: boolean;
}

const VALID_EMOTIONS = new Set([
  'joy', 'laugh', 'surprise', 'shy', 'sad', 'sadness',
  'excited', 'thinking', 'trust', 'fear', 'anger', 'disgust',
  'anticipation', 'neutral',
]);

function parseIntent(raw: string): ActionIntent | null {
  try {
    const parsed = JSON.parse(raw.trim()) as Record<string, unknown>;
    if (typeof parsed.emotion === 'string' && VALID_EMOTIONS.has(parsed.emotion)) {
      return { emotion: parsed.emotion };
    }
  } catch {
    // malformed JSON — discard
  }
  return null;
}

/**
 * Processes a raw streaming text buffer.
 * - Strips complete <action>...</action> blocks from cleanText.
 * - Returns the last parsed ActionIntent found (if any).
 * - Sets hasPartialTag=true when an unclosed <action> is at the end.
 */
export function parseVRMAction(text: string): ParseActionResult {
  let intent: ActionIntent | null = null;

  const completeRegex = /<action>([\s\S]*?)<\/action>/g;
  let match: RegExpExecArray | null;
  while ((match = completeRegex.exec(text)) !== null) {
    const parsed = parseIntent(match[1]);
    if (parsed) intent = parsed; // keep last valid intent
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
