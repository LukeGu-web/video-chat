# Motion Coordinator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the dual-channel VRM motion system with a single `MotionCoordinator` so all animation signals (camera, AI status, AI `<action>`, TTS) are sequenced naturally instead of interrupting each other.

**Architecture:** A module-level singleton `motionCoordinator` (same pattern as `lipSyncBridge`) receives all motion signals, maintains a state machine with a pending-emotion slot, and outputs a single stream of `VRMCommand` objects to the registered `CharacterAvatar` handler. The character-side `ExpressionController` adds a lightweight priority guard as the last line of defence.

**Tech Stack:** TypeScript, React Native (Zustand stores), Remix/Three.js (character WebApp). No test runner — verify each task with `cd EmoMate && npx tsc --noEmit` (must produce zero errors).

---

## File Map

| File | Action | Responsibility after change |
|---|---|---|
| `EmoMate/src/types/speak/common.ts` | Modify | Add `animationHint` to `TTSSynthesisOptions` |
| `EmoMate/src/types/vrm.ts` | Modify | Add `'playVRMA'` to `VRMCommand.type` (VRMA extension point) |
| `EmoMate/src/capabilities/motion/MotionCoordinator.ts` | **Create** | State machine singleton — all signal intake, single output |
| `EmoMate/src/capabilities/motion/index.ts` | Modify | Export `motionCoordinator` |
| `EmoMate/src/utils/parseVRMAction.ts` | Modify | Parse new high-level `{"emotion":"..."}` format |
| `EmoMate/src/components/CharacterAvatar.tsx` | Modify | Register coordinator handler; remove `lipSyncBridge` |
| `EmoMate/src/components/EmotionAwareCharacter.tsx` | Modify | Route camera emotion + AI thinking to coordinator; remove `selectMotion` |
| `EmoMate/src/hooks/useChatAI.ts` | Modify | Dispatch `onAIAction`; attach `animationHint` to each TTS sentence |
| `EmoMate/src/capabilities/speak/hooks/useTTSQueue.ts` | Modify | Call `onTTSStart` / `onTTSEnd` on coordinator |
| `EmoMate/src/constants/ai.ts` | Modify | Add `<action>` format rule to system prompt |
| `EmoMate/src/capabilities/speak/lipSyncBridge.ts` | Delete | Replaced entirely by coordinator |
| `character/app/components/ExpressionController.tsx` | Modify | Priority guard; add `playVRMA` stub case |

---

## Task 1: Extend Types

**Files:**

- Modify: `EmoMate/src/types/speak/common.ts`
- Modify: `EmoMate/src/types/vrm.ts`

- [ ] **Step 1: Add `animationHint` to `TTSSynthesisOptions`**

Open `EmoMate/src/types/speak/common.ts`. The `TTSSynthesisOptions` interface currently ends at line 46. Add one field:

```typescript
export interface TTSSynthesisOptions {
  voiceId?: string;
  emotion?: string;
  language?: string;
  pitch?: number;
  rate?: number;
  animationHint?: string; // "laugh" | "speaking" | EmotionType — attached by useChatAI
}
```

- [ ] **Step 2: Add `playVRMA` to VRMCommand type (VRMA extension point)**

Open `EmoMate/src/types/vrm.ts`. Update the `VRMCommand` interface:

```typescript
export interface VRMCommand {
  type:
    | 'setExpression'
    | 'playPreset'
    | 'playPose'
    | 'playVRMA'       // reserved for future VRMA clip support
    | 'stopAll'
    | 'prepareVisemes'
    | 'stopVisemes'
    | 'lipSyncStart';
  data?: any;
}
```

- [ ] **Step 3: Verify TypeScript**

```bash
cd /Users/yaonangu/Local_doc/GitHub/video-chat/EmoMate && npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 4: Commit**

```bash
git add EmoMate/src/types/speak/common.ts EmoMate/src/types/vrm.ts
git commit -m "feat: extend types for MotionCoordinator (animationHint, playVRMA)"
```

---

## Task 2: Create MotionCoordinator

**Files:**

- Create: `EmoMate/src/capabilities/motion/MotionCoordinator.ts`
- Modify: `EmoMate/src/capabilities/motion/index.ts`

- [ ] **Step 1: Create `MotionCoordinator.ts`**

Create `EmoMate/src/capabilities/motion/MotionCoordinator.ts` with the full content below:

```typescript
import { EmotionType } from '../../types/emotion';
import { VRMCommand } from '../../types/vrm';

// ─── Emotion → preset name ────────────────────────────────────────────────────

const EMOTION_PRESET: Record<string, string> = {
  joy:         'happy',
  laugh:       'laugh',
  surprise:    'surprised',
  shy:         'shy',
  sad:         'sleepy',
  sadness:     'sleepy',
  excited:     'excited',
  anticipation:'excited',
  thinking:    'thinking',
  trust:       'happy',
  fear:        'shy',
  anger:       'surprised',
  disgust:     'thinking',
  neutral:     'idle',
};

// ─── Emotion → blendShapes ────────────────────────────────────────────────────

const EMOTION_BLEND: Record<string, Record<string, number>> = {
  joy:         { joy: 0.8 },
  laugh:       { joy: 0.6 },
  surprise:    { surprised: 0.9 },
  shy:         { joy: 0.3 },
  sad:         { sorrow: 0.7 },
  sadness:     { sorrow: 0.7 },
  excited:     { joy: 0.8 },
  anticipation:{ fun: 0.5 },
  trust:       { joy: 0.4, fun: 0.3 },
  fear:        { surprised: 0.5, sorrow: 0.3 },
  anger:       { angry: 0.6 },
};

// ─── Preset durations (ms) ────────────────────────────────────────────────────

const PRESET_DURATION: Record<string, number> = {
  wave:      3000,
  dance:     5000,
  laugh:     3000,
  excited:   3000,
  surprised: 2000,
  thinking:  3000,
  happy:     4000,
  shy:       3000,
  sleepy:    5000,
};

// ─── State ────────────────────────────────────────────────────────────────────

type CoordState =
  | 'Idle'
  | 'Thinking'
  | 'TTS_Speaking'
  | 'TTS_Laughing'
  | { tag: 'TTS_Emotion';    emotion: string }
  | { tag: 'PostTTS_Emotion'; emotion: string }
  | { tag: 'CameraEmotion';  emotion: string };

type VRMCommandFn = (cmd: VRMCommand) => void;

let _handler: VRMCommandFn | null = null;
let _state: CoordState = 'Idle';
let _pending: string | null = null;      // emotion waiting for TTS to end
let _postTimer: ReturnType<typeof setTimeout> | null = null;
let _camTimer:  ReturnType<typeof setTimeout> | null = null;

// ─── Internal helpers ─────────────────────────────────────────────────────────

function send(cmd: VRMCommand): void {
  _handler?.(cmd);
}

function sendPreset(name: string): void {
  send({ type: 'playPreset', data: { name } });
}

function sendExpression(blendShapes: Record<string, number>): void {
  send({
    type: 'setExpression',
    data: { blendShapes, duration: 0.5, holdDuration: 3 },
  });
}

function clearPostTimer(): void {
  if (_postTimer) { clearTimeout(_postTimer); _postTimer = null; }
}

function clearCamTimer(): void {
  if (_camTimer) { clearTimeout(_camTimer); _camTimer = null; }
}

function isTTSActive(s: CoordState): boolean {
  return (
    s === 'TTS_Speaking' ||
    s === 'TTS_Laughing' ||
    (typeof s === 'object' && s.tag === 'TTS_Emotion')
  );
}

function playEmotionThenIdle(emotion: string): void {
  const preset = EMOTION_PRESET[emotion] ?? 'idle';
  const blends = EMOTION_BLEND[emotion];
  sendPreset(preset);
  if (blends) sendExpression(blends);

  const duration = PRESET_DURATION[preset] ?? 3000;
  clearPostTimer();
  _postTimer = setTimeout(() => {
    _state = 'Idle';
    sendPreset('idle');
    _postTimer = null;
  }, duration);
}

// ─── Public API ───────────────────────────────────────────────────────────────

export const motionCoordinator = {
  /** Called by CharacterAvatar once the WebView is ready. */
  register(fn: VRMCommandFn): void {
    _handler = fn;
  },

  unregister(): void {
    _handler = null;
  },

  /** AI started or stopped thinking. Highest priority — interrupts everything. */
  onAIThinking(isThinking: boolean): void {
    if (isThinking) {
      clearPostTimer();
      clearCamTimer();
      _state = 'Thinking';
      sendPreset('thinking');
    } else {
      if (_pending) {
        const emotion = _pending;
        _pending = null;
        _state = { tag: 'PostTTS_Emotion', emotion };
        playEmotionThenIdle(emotion);
      } else {
        _state = 'Idle';
        sendPreset('idle');
      }
    }
  },

  /**
   * Called by useTTSQueue when a segment starts playing.
   * hint: "laugh" | "speaking" (default) | EmotionType
   */
  onTTSStart(hint: string): void {
    clearPostTimer();
    clearCamTimer();
    if (hint === 'laugh') {
      _state = 'TTS_Laughing';
      sendPreset('laugh');
    } else if (!hint || hint === 'speaking') {
      _state = 'TTS_Speaking';
      sendPreset('speaking');
    } else {
      _state = { tag: 'TTS_Emotion', emotion: hint };
      const preset = EMOTION_PRESET[hint] ?? 'speaking';
      sendPreset(preset);
      const blends = EMOTION_BLEND[hint];
      if (blends) sendExpression(blends);
    }
  },

  /** Called by useTTSQueue when a segment finishes playing. */
  onTTSEnd(): void {
    if (_pending) {
      const emotion = _pending;
      _pending = null;
      _state = { tag: 'PostTTS_Emotion', emotion };
      playEmotionThenIdle(emotion);
    } else {
      _state = 'Idle';
      sendPreset('idle');
    }
  },

  /**
   * Called when a <action>{"emotion":"..."}</action> is parsed from AI reply.
   * If TTS is active, stores as pending (plays after TTS ends).
   * If idle, plays immediately.
   */
  onAIAction(emotion: string): void {
    if (isTTSActive(_state) || _state === 'Thinking') {
      _pending = emotion;
    } else {
      _state = { tag: 'PostTTS_Emotion', emotion };
      playEmotionThenIdle(emotion);
    }
  },

  /**
   * Called when camera detects a stable emotion.
   * Only acts when character is idle; ignored during speech / thinking.
   */
  onCameraEmotion(emotion: EmotionType): void {
    if (_state !== 'Idle') return;
    if (emotion === 'neutral') return;

    const preset = EMOTION_PRESET[emotion] ?? 'idle';
    if (preset === 'idle') return;

    clearCamTimer();
    _state = { tag: 'CameraEmotion', emotion };
    sendPreset(preset);
    const blends = EMOTION_BLEND[emotion];
    if (blends) sendExpression(blends);

    const duration = PRESET_DURATION[preset] ?? 3000;
    _camTimer = setTimeout(() => {
      if (typeof _state === 'object' && _state.tag === 'CameraEmotion') {
        _state = 'Idle';
        sendPreset('idle');
      }
      _camTimer = null;
    }, duration);
  },

  /** Visemes always pass through regardless of motion state. */
  onVisemes(data: unknown): void {
    send({ type: 'prepareVisemes', data });
  },

  onStopVisemes(): void {
    send({ type: 'stopVisemes' });
  },

  /** Hard reset — used when TTS is cancelled. */
  reset(): void {
    clearPostTimer();
    clearCamTimer();
    _state = 'Idle';
    _pending = null;
    sendPreset('idle');
  },
};
```

- [ ] **Step 2: Export from barrel**

Open `EmoMate/src/capabilities/motion/index.ts`. Add the export:

```typescript
export { motionCoordinator } from './MotionCoordinator';
```

(Keep any existing exports in the file.)

- [ ] **Step 3: Verify TypeScript**

```bash
cd /Users/yaonangu/Local_doc/GitHub/video-chat/EmoMate && npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 4: Commit**

```bash
git add EmoMate/src/capabilities/motion/MotionCoordinator.ts EmoMate/src/capabilities/motion/index.ts
git commit -m "feat: add MotionCoordinator state machine"
```

---

## Task 3: Update `parseVRMAction` to High-Level Format

**Files:**

- Modify: `EmoMate/src/utils/parseVRMAction.ts`

The current function returns `{ action: VRMActionPayload | null, cleanText, hasPartialTag }`. We replace `action` with `intent: ActionIntent | null`.

- [ ] **Step 1: Rewrite `parseVRMAction.ts`**

Replace the entire content of `EmoMate/src/utils/parseVRMAction.ts`:

```typescript
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
```

- [ ] **Step 2: Fix the import in `useChatAI.ts` (interim — callers updated in Task 6)**

Open `EmoMate/src/hooks/useChatAI.ts`. Find the line that uses `parseVRMAction`. The current destructuring is:

```typescript
const { action, cleanText, hasPartialTag } = parseVRMAction(rawBuffer);
if (action) {
  lipSyncBridge.sendVRMCommand({ type: 'playPose', data: action });
  ...
}
```

Replace with a temporary no-op to keep the build green (full wiring is in Task 6):

```typescript
const { intent, cleanText, hasPartialTag } = parseVRMAction(rawBuffer);
// TODO Task 6: wire intent to motionCoordinator
void intent;
```

Also update the `xhr.onload` section. Find:

```typescript
const { cleanText: cleanFinal } = parseVRMAction(partialSentence.trim());
```

This destructuring is already compatible with the new return type — no change needed.

- [ ] **Step 3: Verify TypeScript**

```bash
cd /Users/yaonangu/Local_doc/GitHub/video-chat/EmoMate && npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 4: Commit**

```bash
git add EmoMate/src/utils/parseVRMAction.ts EmoMate/src/hooks/useChatAI.ts
git commit -m "feat: parseVRMAction now returns high-level ActionIntent"
```

---

## Task 4: Wire CharacterAvatar to MotionCoordinator

**Files:**

- Modify: `EmoMate/src/components/CharacterAvatar.tsx`

Replace the `lipSyncBridge.register` call and all motion-dispatching logic with a single `motionCoordinator.register` call. The coordinator now owns all command decisions.

- [ ] **Step 1: Update `CharacterAvatar.tsx`**

Replace the entire file content:

```typescript
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { View } from 'react-native';
import CharacterWebView, { AvatarBridge } from './CharacterWebView';
import { debugLog, debugError } from '../utils/debug';
import { useMonitorStore } from '../store/monitorStore';
import { motionCoordinator } from '../capabilities/motion';

interface CharacterAvatarProps {
  size?: number;
  onMotionComplete?: (motion: string, success: boolean) => void;
}

interface WebViewRef {
  avatarBridge: AvatarBridge;
  reload: () => void;
  webView: any;
}

const CharacterAvatar: React.FC<CharacterAvatarProps> = ({
  size = 240,
  onMotionComplete,
}) => {
  const webViewRef = useRef<WebViewRef>(null);
  const [isModelReady, setIsModelReady] = useState(false);

  const updateAvatarStatus = useMonitorStore((state) => state.updateAvatarStatus);

  useEffect(() => {
    updateAvatarStatus({ currentMotion: 'Idle', isModelReady, isPlaying: false, shouldLoop: false });
  }, [isModelReady, updateAvatarStatus]);

  const handleModelReady = useCallback(() => {
    debugLog('CharacterAvatar', 'Model ready');
    setIsModelReady(true);

    motionCoordinator.register((cmd) => {
      webViewRef.current?.avatarBridge.sendVRMCommand(cmd);
    });
  }, []);

  const handleMotionResult = useCallback(
    (motion: string, success: boolean, error?: string) => {
      debugLog('CharacterAvatar', `Motion result — ${motion}: ${success ? 'ok' : error}`);
      onMotionComplete?.(motion, success);
    },
    [onMotionComplete],
  );

  useEffect(() => {
    return () => {
      motionCoordinator.unregister();
    };
  }, []);

  return (
    <View style={{ width: size, height: size * 1.6 }}>
      <CharacterWebView
        ref={webViewRef}
        style={{ width: '100%', height: '100%' }}
        onModelReady={handleModelReady}
        onMotionResult={handleMotionResult}
      />
    </View>
  );
};

export default CharacterAvatar;
export type { CharacterAvatarProps };
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd /Users/yaonangu/Local_doc/GitHub/video-chat/EmoMate && npx tsc --noEmit
```

Expected: zero errors. (Errors about removed props like `status` / `emotion` will surface — fix them by removing those props from call sites. Check `EmotionAwareCharacter.tsx` and update in the next task.)

- [ ] **Step 3: Commit**

```bash
git add EmoMate/src/components/CharacterAvatar.tsx
git commit -m "feat: CharacterAvatar registers motionCoordinator handler"
```

---

## Task 5: Refactor EmotionAwareCharacter

**Files:**

- Modify: `EmoMate/src/components/EmotionAwareCharacter.tsx`

Remove all `selectMotion` / `returnToIdleTimer` logic. Route camera emotion and AI thinking state directly to the coordinator.

- [ ] **Step 1: Replace `EmotionAwareCharacter.tsx`**

```typescript
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
    const isThinking = aiStatus === 'Thinking';
    debugLog('EmotionAwareCharacter', `AI thinking: ${isThinking}`);
    motionCoordinator.onAIThinking(isThinking);
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
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd /Users/yaonangu/Local_doc/GitHub/video-chat/EmoMate && npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add EmoMate/src/components/EmotionAwareCharacter.tsx
git commit -m "refactor: EmotionAwareCharacter routes signals to motionCoordinator"
```

---

## Task 6: Wire `useChatAI` to Coordinator

**Files:**

- Modify: `EmoMate/src/hooks/useChatAI.ts`

Replace the `lipSyncBridge` calls with `motionCoordinator` calls. Add `pendingHint` logic to attach `animationHint` to the next TTS sentence. Fix the broken `setTextEmotion` link.

- [ ] **Step 1: Update imports at top of `useChatAI.ts`**

Find the existing imports block. Remove the `lipSyncBridge` import and add coordinator + emotionStore:

```typescript
// Remove this line:
import { lipSyncBridge } from '../capabilities/speak/lipSyncBridge';

// Add these lines:
import { motionCoordinator } from '../capabilities/motion';
import { useEmotionStore } from '../store';
```

- [ ] **Step 2: Add `pendingHint` variable inside the streaming handler**

Inside the `xhr.onprogress` callback, after the existing variable declarations (`rawBuffer`, `processedLength`, etc.), add:

```typescript
let pendingHint: string | null = null; // attached to the next enqueued sentence
```

- [ ] **Step 3: Replace the action dispatch block**

Find this block (around line 253–257 after the Task 3 interim change):

```typescript
const { intent, cleanText, hasPartialTag } = parseVRMAction(rawBuffer);
// TODO Task 6: wire intent to motionCoordinator
void intent;
```

Replace with:

```typescript
const { intent, cleanText, hasPartialTag } = parseVRMAction(rawBuffer);
if (intent) {
  // Map action emotion names to Plutchik EmotionType for the store
  // ("laugh" → "joy", "sad" → "sadness" — the rest match directly)
  const STORE_EMOTION_MAP: Record<string, string> = { laugh: 'joy', sad: 'sadness' };
  const storeEmotion = STORE_EMOTION_MAP[intent.emotion] ?? intent.emotion;
  useEmotionStore.getState().setTextEmotion(storeEmotion as EmotionType);
  motionCoordinator.onAIAction(intent.emotion);
  pendingHint = intent.emotion; // attach to next sentence
  debugLog('ChatAI', 'AI action dispatched', intent);
}
```

- [ ] **Step 4: Attach `animationHint` when calling `onSentence`**

Find the block that calls `onSentence(sentence)` (around the sentence-ending detection loop). Add laugh auto-detection and pass `animationHint`:

```typescript
if (sentenceEndings.includes(char)) {
  const sentence = stripActionDescriptions(currentSentence.trim());
  if (sentence) {
    // Auto-detect laugh sounds as a fallback if no explicit hint
    const LAUGH_PATTERN = /^[哈嘿呵hH]+[哈嘿呵!！~～\s]*$/;
    const hint = pendingHint ?? (LAUGH_PATTERN.test(sentence) ? 'laugh' : undefined);
    pendingHint = null; // consume after first sentence

    onSentence(sentence, hint ? { animationHint: hint } : undefined);
    fullText += sentence;
  }
  currentSentence = '';
}
```

- [ ] **Step 5: Update `onSentence` signature and the TTS enqueue call site**

`onSentence` is the internal async callback defined at line 166 of `useChatAI.ts` and called at line 460. It currently has signature `(sentence: string) => void`.

**5a — Change the parameter type** at the `callClaudeAPIStreaming` definition (line 166):

```typescript
// Old:
onSentence: (sentence: string) => void

// New:
onSentence: (sentence: string, options?: TTSSynthesisOptions) => void
```

Add the import at the top of `useChatAI.ts` if not already present:

```typescript
import { TTSSynthesisOptions } from '../types/speak';
```

**5b — Update the call site** (line 460, the async lambda passed into `callClaudeAPIStreaming`):

```typescript
// Old:
async (sentence) => {
  if (enhancedConfig?.enableTTS !== false) {
    await ttsQueue.enqueue(sentence, { voiceId, emotion: userEmotion });
  }
}

// New:
async (sentence, sentenceOptions) => {
  if (enhancedConfig?.enableTTS !== false) {
    await ttsQueue.enqueue(sentence, {
      voiceId,
      emotion: userEmotion,
      ...sentenceOptions,   // carries animationHint from step 4
    });
  }
}
```

- [ ] **Step 6: Replace remaining `lipSyncBridge` calls**

Search the file for remaining `lipSyncBridge` usages:

```bash
grep -n "lipSyncBridge" /Users/yaonangu/Local_doc/GitHub/video-chat/EmoMate/src/hooks/useChatAI.ts
```

For each remaining call:

- `lipSyncBridge.sendVRMCommand({ type: 'prepareVisemes', data: { visemes, totalDuration } })`
  → `motionCoordinator.onVisemes({ visemes, totalDuration })`

- `lipSyncBridge.sendVRMCommand({ type: 'stopVisemes' })`
  → `motionCoordinator.onStopVisemes()`

- [ ] **Step 7: Verify TypeScript**

```bash
cd /Users/yaonangu/Local_doc/GitHub/video-chat/EmoMate && npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 8: Commit**

```bash
git add EmoMate/src/hooks/useChatAI.ts
git commit -m "feat: useChatAI dispatches to motionCoordinator, passes animationHint"
```

---

## Task 7: Wire TTSQueue Callbacks to Coordinator

**Files:**

- Modify: `EmoMate/src/capabilities/speak/hooks/useTTSQueue.ts`

- [ ] **Step 1: Add coordinator import**

At the top of `useTTSQueue.ts`:

```typescript
// Remove:
import { lipSyncBridge } from '../lipSyncBridge';

// Add:
import { motionCoordinator } from '../../capabilities/motion';
```

Wait — this file is already inside `capabilities/speak/hooks/`, so the import path for the coordinator is:

```typescript
import { motionCoordinator } from '../../motion';
```

- [ ] **Step 2: Update `onItemStart` and `onItemEnd` in the queue config**

Find the `queueConfig` object inside the `useEffect` (around lines 54–69). Update it:

```typescript
const queueConfig: TTSQueueConfig = {
  ...config,
  onItemStart: (item) => {
    setIsPlaying(true);
    const hint = item.options?.animationHint ?? 'speaking';
    motionCoordinator.onTTSStart(hint);
    config?.onItemStart?.(item);
  },
  onItemEnd: (item) => {
    motionCoordinator.onTTSEnd();
    config?.onItemEnd?.(item);
    updateStatus();
  },
  onItemError: (item, error) => {
    config?.onItemError?.(item, error);
    updateStatus();
  },
};
```

- [ ] **Step 3: Update `cancel()` to use coordinator**

Find the `cancel` callback:

```typescript
const cancel = useCallback(async () => {
  if (!queueRef.current) return;
  await queueRef.current.cancel();
  lipSyncBridge.sendVRMCommand({ type: 'stopVisemes' });  // old
  setIsPlaying(false);
  setIsSynthesizing(false);
  updateStatus();
}, [updateStatus]);
```

Replace with:

```typescript
const cancel = useCallback(async () => {
  if (!queueRef.current) return;
  await queueRef.current.cancel();
  motionCoordinator.onStopVisemes();
  motionCoordinator.reset();
  setIsPlaying(false);
  setIsSynthesizing(false);
  updateStatus();
}, [updateStatus]);
```

- [ ] **Step 4: Verify TypeScript**

```bash
cd /Users/yaonangu/Local_doc/GitHub/video-chat/EmoMate && npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 5: Commit**

```bash
git add EmoMate/src/capabilities/speak/hooks/useTTSQueue.ts
git commit -m "feat: useTTSQueue notifies motionCoordinator on item start/end/cancel"
```

---

## Task 8: Update AI Prompt

**Files:**

- Modify: `EmoMate/src/constants/ai.ts`

- [ ] **Step 1: Find the action format instruction block**

```bash
grep -n "action\|blendShape\|骨骼\|emotion" /Users/yaonangu/Local_doc/GitHub/video-chat/EmoMate/src/constants/ai.ts | grep -i "action\|骨骼\|blendShape" | head -20
```

- [ ] **Step 2: Replace the old `<action>` format instruction with the new one**

Find the section in the system prompt that describes the `<action>` tag format (it will mention `blendShapes` and bone values). Replace that entire section with:

```
当你想表达明显情绪时，在相关句子**前**插入 <action> 标签：

<action>{"emotion":"laugh"}</action>哈哈哈，真的好笑！
<action>{"emotion":"joy"}</action>太棒了！

规则：
- 每次回复最多使用 1～2 个 <action> 标签
- 只在情绪清晰、强烈时使用，不要在每句话前都加
- emotion 的值只能是以下之一：joy / laugh / surprise / shy / sad / excited / thinking / trust
- 标签紧贴句子前，中间不加空格或换行
```

- [ ] **Step 3: Verify TypeScript**

```bash
cd /Users/yaonangu/Local_doc/GitHub/video-chat/EmoMate && npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 4: Commit**

```bash
git add EmoMate/src/constants/ai.ts
git commit -m "feat: update AI prompt to use high-level emotion <action> format"
```

---

## Task 9: ExpressionController Priority Guard + VRMA Stub

**Files:**

- Modify: `character/app/components/ExpressionController.tsx`

- [ ] **Step 1: Add priority constants and state ref**

Open `character/app/components/ExpressionController.tsx`. After the existing `idleReturnTimer` ref (around line 136), add:

```typescript
const CMD_PRIORITY = { setExpression: 0, playPose: 1, playPreset: 2 } as const;
const currentPriority = useRef(0);
```

- [ ] **Step 2: Apply priority check in `playPreset` handler**

Inside the `handleMessage` function, find the `case 'playPreset':` block (around line 257). Wrap the execution in a priority check:

```typescript
case 'playPreset': {
  if (CMD_PRIORITY.playPreset < currentPriority.current) break; // blocked by higher priority
  const newPresetDef = MOTION_PRESETS[cmd.data.name];
  if (newPresetDef) {
    const current = presetState.current;
    const lastKfTime = newPresetDef.keyframes[newPresetDef.keyframes.length - 1].time;
    const alreadyPlaying =
      !newPresetDef.loop &&
      current.name === cmd.data.name &&
      current.elapsed <= lastKfTime + 1.0;

    if (!alreadyPlaying) {
      currentPriority.current = CMD_PRIORITY.playPreset;
      presetState.current = {
        name: cmd.data.name,
        elapsed: 0,
        loop: cmd.data.loop ?? newPresetDef.loop,
      };
    }
  }
  break;
}
```

- [ ] **Step 3: Reset priority when a preset finishes**

In the `useFrame` callback, find the block that returns non-loop presets to idle (around line 398–411). After `presetState.current = { name: 'idle', elapsed: 0, loop: true }`, add:

```typescript
currentPriority.current = 0; // preset finished — accept new commands
```

- [ ] **Step 4: Add `playVRMA` stub case (VRMA extension point)**

Inside `handleMessage`, after the `case 'stopAll':` block, add:

```typescript
case 'playVRMA':
  // Reserved for future VRMA clip support.
  // Implement by loading and playing a .vrma file via @pixiv/three-vrm-animation.
  console.warn('[ExpressionController] playVRMA not yet implemented:', cmd.data);
  break;
```

- [ ] **Step 5: Verify TypeScript (character side)**

```bash
cd /Users/yaonangu/Local_doc/GitHub/video-chat/character && npm run typecheck
```

Expected: zero errors.

- [ ] **Step 6: Commit**

```bash
git add character/app/components/ExpressionController.tsx
git commit -m "feat: ExpressionController priority guard + playVRMA stub"
```

---

## Task 10: Remove `lipSyncBridge`

**Files:**

- Delete: `EmoMate/src/capabilities/speak/lipSyncBridge.ts`
- Modify: any file still importing it

- [ ] **Step 1: Check for remaining imports**

```bash
grep -rn "lipSyncBridge" /Users/yaonangu/Local_doc/GitHub/video-chat/EmoMate/src
```

Expected: zero results (all callers were updated in Tasks 4–7). If any remain, fix them before proceeding.

- [ ] **Step 2: Delete the file**

```bash
rm /Users/yaonangu/Local_doc/GitHub/video-chat/EmoMate/src/capabilities/speak/lipSyncBridge.ts
```

- [ ] **Step 3: Verify TypeScript**

```bash
cd /Users/yaonangu/Local_doc/GitHub/video-chat/EmoMate && npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove lipSyncBridge (replaced by motionCoordinator)"
```

---

## Task 11: Integration Smoke Test

No automated tests exist. Perform manual verification against these three scenarios.

- [ ] **Scenario A — Basic greeting**

Start character server (`cd character && npm run dev`) and EmoMate (`cd EmoMate && npx expo start`).

Say: "你好"

Expected sequence in character WebView:

1. AI thinking → Thinking animation
2. TTS starts → Speaking animation
3. TTS ends → Idle

- [ ] **Scenario B — Laugh request**

Say: "哈哈，你也笑一下"

Expected:

1. AI thinking → Thinking
2. TTS plays "哈哈哈！" → Laugh animation (NOT Speaking)
3. TTS plays remainder → Speaking animation
4. TTS ends + pending emotion → Happy/Laugh preset plays once
5. Returns to Idle

- [ ] **Scenario C — Camera emotion during idle**

Keep app silent for 10 seconds (character should be in Idle). Smile visibly at camera.

Expected:

1. Camera detects joy → Happy preset plays briefly
2. Returns to Idle after ~4s
3. If you then speak, Happy is ignored (non-idle state)

- [ ] **Scenario D — Thinking interrupts emotion**

Ask a long question. Observe:

1. AI starts thinking → Thinking animation fires immediately, regardless of prior state

- [ ] **Commit final status**

```bash
git add -A
git commit -m "test: motion coordinator integration verified"
```
