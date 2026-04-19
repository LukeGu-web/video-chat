# VRM Phase 3 — Lip Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the character's mouth move in sync with TTS audio. Uses text-driven viseme timing — no changes to expo-av or TTSQueue internals. EmoMate converts the spoken text to a timed viseme sequence and sends it to the WebView; `LipSyncController` plays the sequence frame-by-frame via `useFrame`.

**Architecture:**
1. When TTSQueue starts playing an item (`onItemStart`), EmoMate calls `textToViseme(item.text)` to get `{ shape, time }[]`
2. `sendVRMCommand({ type: 'playVisemes', data: { visemes, totalDuration } })` is called
3. WebView's `LipSyncController` receives the sequence and drives VRM mouth blend shapes on a timeline
4. When TTSQueue finishes the item (`onItemEnd`), `sendVRMCommand({ type: 'stopVisemes' })` closes the mouth
5. expo-av and TTSQueue are **not modified**

**Tech Stack:** React Three Fiber `useFrame`, `@pixiv/three-vrm` expression manager, pinyin-based Chinese text analysis (no external package needed)

---

## Task 1: Extend bridge types for viseme commands

**Files:**
- Modify: `character/app/types/vrm-bridge.ts`
- Modify: `EmoMate/src/types/vrm.ts`

- [ ] **Step 1: Add viseme types to character/app/types/vrm-bridge.ts**

Add these types and extend `VRMBridgeCommand`:

```typescript
export interface VisemeFrame {
  shape: 'aa' | 'ee' | 'ih' | 'oh' | 'ou' | 'sil';
  time: number;   // seconds from playback start
  weight: number; // 0–1 intensity
}

// In VRMBridgeCommand union, add:
| { type: 'playVisemes'; data: { visemes: VisemeFrame[]; totalDuration: number } }
| { type: 'stopVisemes' }
```

- [ ] **Step 2: Add viseme types to EmoMate/src/types/vrm.ts**

Add matching types (EmoMate side):

```typescript
export interface VisemeFrame {
  shape: 'aa' | 'ee' | 'ih' | 'oh' | 'ou' | 'sil';
  time: number;
  weight: number;
}
```

- [ ] **Step 3: Commit**

```bash
git add character/app/types/vrm-bridge.ts EmoMate/src/types/vrm.ts
git commit -m "feat: add playVisemes/stopVisemes bridge types"
```

---

## Task 2: Create textToViseme utility in EmoMate

**Files:**
- Create: `EmoMate/src/capabilities/speak/textToViseme.ts`

Convert spoken text to a timed viseme sequence without any external package.

- [ ] **Step 1: Create the file**

```typescript
// EmoMate/src/capabilities/speak/textToViseme.ts

import { VisemeFrame } from '../../types/vrm';

// Seconds per Chinese character at normal TTS speed
const MS_PER_CHAR = 0.2;
// Pause duration for punctuation (seconds)
const PAUSE_DURATION = 0.15;

// Pinyin final → mouth shape mapping
// Covers the most common Chinese vowel endings
const FINAL_TO_SHAPE: Record<string, VisemeFrame['shape']> = {
  a: 'aa', ai: 'aa', ao: 'aa', an: 'aa', ang: 'aa',
  e: 'ee', ei: 'ee', en: 'ee', eng: 'ee', er: 'ee',
  i: 'ih', in: 'ih', ing: 'ih',
  o: 'oh', ou: 'oh', ong: 'oh',
  u: 'ou', un: 'ou', uan: 'ou',
  v: 'ih', // ü
};

// Common Chinese character → approximate mouth shape (top-frequency chars)
const CHAR_TO_SHAPE: Record<string, VisemeFrame['shape']> = {
  '的': 'ee', '了': 'oh', '是': 'sil', '我': 'oh', '不': 'ou',
  '你': 'ih', '他': 'aa', '她': 'aa', '好': 'aa', '在': 'aa',
  '有': 'ou', '这': 'ee', '那': 'aa', '很': 'ee', '也': 'ee',
  '就': 'ou', '都': 'ou', '说': 'oh', '来': 'aa', '去': 'ih',
  '一': 'ih', '二': 'ee', '三': 'aa', '四': 'sil', '五': 'ou',
  '啊': 'aa', '嗯': 'ee', '哦': 'oh', '呢': 'ee', '吧': 'aa',
  '嘿': 'ee', '哇': 'aa', '呀': 'aa', '嘛': 'aa', '哈': 'aa',
};

const PUNCTUATION = new Set(['。', '，', '！', '？', '、', '.', ',', '!', '?', '…', '~', '·']);

function charToShape(ch: string): VisemeFrame['shape'] {
  if (CHAR_TO_SHAPE[ch]) return CHAR_TO_SHAPE[ch];
  // Default: alternate between aa and ee for unknown chars
  const code = ch.charCodeAt(0);
  const shapes: VisemeFrame['shape'][] = ['aa', 'ee', 'ih', 'oh'];
  return shapes[code % shapes.length];
}

/**
 * Convert spoken text to a timed viseme sequence.
 * @param text - The text being spoken
 * @returns Array of viseme frames with time in seconds
 */
export function textToViseme(text: string): { visemes: VisemeFrame[]; totalDuration: number } {
  const visemes: VisemeFrame[] = [];
  let t = 0;

  // Opening silence
  visemes.push({ shape: 'sil', time: 0, weight: 0 });

  for (const ch of text) {
    if (PUNCTUATION.has(ch)) {
      // Punctuation: mouth close + pause
      visemes.push({ shape: 'sil', time: t, weight: 0 });
      t += PAUSE_DURATION;
      continue;
    }

    // Skip non-CJK, non-ASCII printable chars (e.g. emoji, spaces)
    const isCJK = ch.charCodeAt(0) >= 0x4e00 && ch.charCodeAt(0) <= 0x9fff;
    const isAscii = ch.charCodeAt(0) >= 0x20 && ch.charCodeAt(0) <= 0x7e;
    if (!isCJK && !isAscii) continue;

    const shape = charToShape(ch);
    const charDuration = MS_PER_CHAR;

    // Open mouth at start of char
    visemes.push({ shape, time: t, weight: 0.85 });
    // Start closing halfway through
    visemes.push({ shape, time: t + charDuration * 0.6, weight: 0.3 });
    // Close before next char
    visemes.push({ shape: 'sil', time: t + charDuration * 0.9, weight: 0 });

    t += charDuration;
  }

  // Closing silence
  visemes.push({ shape: 'sil', time: t, weight: 0 });

  return { visemes, totalDuration: t + 0.1 };
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd EmoMate
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add EmoMate/src/capabilities/speak/textToViseme.ts
git commit -m "feat: add text-to-viseme converter for Chinese TTS lip sync"
```

---

## Task 3: Create LipSyncController in character/

**Files:**
- Create: `character/app/components/LipSyncController.tsx`

Listens for `playVisemes` / `stopVisemes` bridge messages and drives VRM blend shapes each frame.

- [ ] **Step 1: Create the file**

```tsx
// character/app/components/LipSyncController.tsx

import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { VRM, VRMExpressionPresetName } from '@pixiv/three-vrm';
import { VisemeFrame, VRMBridgeCommand } from '../types/vrm-bridge';

const SHAPE_TO_VRM: Record<VisemeFrame['shape'], string | null> = {
  aa:  VRMExpressionPresetName.Aa,
  ee:  VRMExpressionPresetName.Ee,
  ih:  VRMExpressionPresetName.Ih,
  oh:  VRMExpressionPresetName.Oh,
  ou:  VRMExpressionPresetName.Ou,
  sil: null,
};

const ALL_MOUTH_SHAPES = [
  VRMExpressionPresetName.Aa,
  VRMExpressionPresetName.Ee,
  VRMExpressionPresetName.Ih,
  VRMExpressionPresetName.Oh,
  VRMExpressionPresetName.Ou,
];

interface LipSyncState {
  visemes: VisemeFrame[];
  startTime: number | null;  // performance.now() when playback started
  totalDuration: number;
  active: boolean;
  currentWeight: number;
  currentShape: string | null;
}

interface LipSyncControllerProps {
  vrm: VRM;
}

export function LipSyncController({ vrm }: LipSyncControllerProps) {
  const state = useRef<LipSyncState>({
    visemes: [],
    startTime: null,
    totalDuration: 0,
    active: false,
    currentWeight: 0,
    currentShape: null,
  });

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      let cmd: VRMBridgeCommand;
      try {
        cmd = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
      } catch {
        return;
      }

      if (cmd.type === 'playVisemes') {
        state.current.visemes = cmd.data.visemes;
        state.current.totalDuration = cmd.data.totalDuration;
        state.current.startTime = performance.now();
        state.current.active = true;
      }

      if (cmd.type === 'stopVisemes') {
        state.current.active = false;
        state.current.startTime = null;
        state.current.visemes = [];
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  useFrame((_, delta) => {
    const em = vrm.expressionManager;
    if (!em) return;

    const s = state.current;

    if (!s.active || s.startTime === null) {
      // Smoothly close mouth when inactive
      if (s.currentWeight > 0.01) {
        s.currentWeight = Math.max(0, s.currentWeight - delta * 8);
        if (s.currentShape) {
          em.setValue(s.currentShape, s.currentWeight);
          em.update();
        }
      }
      return;
    }

    const elapsed = (performance.now() - s.startTime) / 1000; // seconds

    // Find current viseme frame
    const frames = s.visemes;
    let targetShape: string | null = null;
    let targetWeight = 0;

    for (let i = frames.length - 1; i >= 0; i--) {
      if (elapsed >= frames[i].time) {
        targetShape = SHAPE_TO_VRM[frames[i].shape];
        targetWeight = frames[i].weight;
        break;
      }
    }

    // Smooth weight toward target
    const lerpSpeed = Math.min(delta * 20, 1);
    s.currentWeight += (targetWeight - s.currentWeight) * lerpSpeed;

    // Clear previous shape if changed
    if (s.currentShape && s.currentShape !== targetShape) {
      em.setValue(s.currentShape, 0);
    }

    // Apply current shape
    if (targetShape) {
      em.setValue(targetShape, Math.max(0, Math.min(1, s.currentWeight)));
    }
    s.currentShape = targetShape;
    em.update();

    // Auto-stop after totalDuration
    if (elapsed > s.totalDuration + 0.3) {
      s.active = false;
      s.startTime = null;
      // Clear all mouth shapes
      ALL_MOUTH_SHAPES.forEach(shape => em.setValue(shape, 0));
      em.update();
    }
  });

  return null;
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd character
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add app/components/LipSyncController.tsx
git commit -m "feat: add LipSyncController for text-driven viseme playback"
```

---

## Task 4: Wire LipSyncController into VRMAvatar

**Files:**
- Modify: `character/app/components/VRMAvatar.tsx`

`LipSyncController` runs inside the Canvas alongside `ExpressionController`, requires a loaded `VRM` instance.

- [ ] **Step 1: Read VRMAvatar.tsx first**

Read the full file before making any changes. Understand where `ExpressionController` is currently rendered.

- [ ] **Step 2: Add import and render LipSyncController**

In `VRMAvatar.tsx`, find where `<ExpressionController vrm={loadedVRM} />` is rendered. Add `LipSyncController` as a sibling:

```tsx
import { LipSyncController } from './LipSyncController';

// In the same JSX block as ExpressionController:
<ExpressionController vrm={loadedVRM} />
<LipSyncController vrm={loadedVRM} />
```

- [ ] **Step 3: TypeScript check**

```bash
cd character
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 4: Commit**

```bash
git add app/components/VRMAvatar.tsx
git commit -m "feat: render LipSyncController inside VRMAvatar Canvas"
```

---

## Task 5: Wire TTSQueue callbacks → sendVRMCommand in EmoMate

**Files:**
- Modify: `EmoMate/src/components/HiyoriWebView.tsx`
- Modify: `character/app/components/LipSyncController.tsx`
- Modify: `character/app/types/vrm-bridge.ts` + `EmoMate/src/types/vrm.ts`

TTSQueue already calls `config.onItemStart(item)` and `config.onItemEnd(item)`. We hook there — zero changes to TTSQueue.ts.

**Timing strategy:** Use two-phase approach to eliminate the WebView bridge latency (~100–300ms) between `onItemStart` and actual audio playback start:
1. `onItemStart` → send `prepareVisemes` (WebView stores sequence, does NOT start)
2. WebView's own Web Audio `onstart` event → self-trigger `startTime = performance.now()` and begin playback

This ensures viseme timing origin = audio playback origin.

- [ ] **Step 1: Read HiyoriWebView.tsx first**

Read the full file. Find:
1. Where `sendVRMCommand` is defined/used
2. Where TTSQueue config is passed (look for `onItemStart`, `onItemEnd`, or where TTSQueue is instantiated/configured)
3. How the component receives or references the TTSQueue instance

- [ ] **Step 2: Add prepareVisemes type to bridge types**

In `character/app/types/vrm-bridge.ts` and `EmoMate/src/types/vrm.ts`, add alongside `playVisemes`:

```typescript
| { type: 'prepareVisemes'; data: { visemes: VisemeFrame[]; totalDuration: number } }
```

- [ ] **Step 3: Update LipSyncController to handle prepareVisemes**

In `LipSyncController.tsx`, change the `playVisemes` handler to `prepareVisemes` — store the sequence but set `active: false` and `startTime: null`. Then add a new internal trigger that fires when the Web Audio source node's `onstart` fires:

```typescript
if (cmd.type === 'prepareVisemes') {
  // Store sequence; timing starts when audio actually begins (onAudioStart below)
  state.current.visemes = cmd.data.visemes;
  state.current.totalDuration = cmd.data.totalDuration;
  state.current.active = false;
  state.current.startTime = null;
}

if (cmd.type === 'playVisemes') {
  // Direct start (kept for browser console testing)
  state.current.visemes = cmd.data.visemes;
  state.current.totalDuration = cmd.data.totalDuration;
  state.current.startTime = performance.now();
  state.current.active = true;
}
```

Also listen for a custom `lipSyncStart` event that `amplifiedAudioBridge` will dispatch when audio decode completes:

```typescript
const handleAudioStart = () => {
  if (state.current.visemes.length > 0) {
    state.current.startTime = performance.now();
    state.current.active = true;
  }
};
window.addEventListener('lipSyncStart', handleAudioStart);
return () => {
  window.removeEventListener('message', handleMessage);
  window.removeEventListener('lipSyncStart', handleAudioStart);
};
```

- [ ] **Step 4: Read amplifiedAudioBridge to understand where to dispatch lipSyncStart**

Read `EmoMate/src/capabilities/speak/providers/amplifiedAudioBridge.ts` in full. Find the WebView HTML/JS that handles audio playback. Locate where the Web Audio source node's `onended` / playback-started callback fires (look for `onstart`, `source.start()`, or equivalent).

- [ ] **Step 5: Dispatch lipSyncStart from amplifiedAudioBridge WebView JS**

In the WebView's inline JS (inside `amplifiedAudioBridge`), immediately after audio decode and `source.start()`, dispatch the custom event:

```javascript
source.start(0);
window.dispatchEvent(new Event('lipSyncStart'));
```

This fires at the exact moment audio begins, giving `LipSyncController` an accurate `startTime`.

- [ ] **Step 6: Import textToViseme and wire onItemStart / onItemEnd**

Add import at top of HiyoriWebView.tsx (or whichever file configures TTSQueue):

```typescript
import { textToViseme } from '../capabilities/speak/textToViseme';
```

Find where TTSQueue is instantiated or configured with callbacks. Add:

```typescript
onItemStart: (item) => {
  const { visemes, totalDuration } = textToViseme(item.text);
  sendVRMCommand({ type: 'prepareVisemes', data: { visemes, totalDuration } });
},
onItemEnd: (_item) => {
  sendVRMCommand({ type: 'stopVisemes' });
},
```

Note: `sendVRMCommand` may need to be accessed via ref or passed as a prop depending on component structure. Read the code first to determine the right pattern — do not assume.

- [ ] **Step 7: TypeScript check**

```bash
cd EmoMate && npx tsc --noEmit 2>&1 | head -30
cd ../character && npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 8: Commit**

```bash
git add EmoMate/src/components/HiyoriWebView.tsx \
        EmoMate/src/capabilities/speak/providers/amplifiedAudioBridge.ts \
        character/app/components/LipSyncController.tsx \
        character/app/types/vrm-bridge.ts \
        EmoMate/src/types/vrm.ts
git commit -m "feat: drive lip sync via prepareVisemes + lipSyncStart for zero-latency sync"
```

---

## Task 6: Handle cancel case — close mouth on TTS cancel

**Files:**
- Modify: whichever file(s) call `ttsQueue.cancel()` (find by searching for `.cancel()`)

`TTSQueue.cancel()` marks items as `failed` without calling `onItemEnd`, so the mouth stays open. Fix by sending `stopVisemes` at every cancel call site.

- [ ] **Step 1: Find all cancel call sites**

```bash
cd EmoMate
grep -rn "\.cancel()" src/ --include="*.ts" --include="*.tsx"
```

- [ ] **Step 2: Add stopVisemes after each cancel call**

At each call site where `ttsQueue.cancel()` (or equivalent) is called, add immediately after:

```typescript
sendVRMCommand({ type: 'stopVisemes' });
```

Note: `sendVRMCommand` access pattern depends on where the cancel is called. If it's inside HiyoriWebView, it's directly available. If it's in useChatAI or HomeScreen, it may need to be passed via a ref or callback — read the code first, do not assume.

- [ ] **Step 3: TypeScript check**

```bash
cd EmoMate
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 4: Commit**

```bash
git add -p  # stage only changed cancel call sites
git commit -m "fix: send stopVisemes on TTS cancel to close mouth immediately"
```

---

## Verification Checklist

Test each item after completing all tasks:

- [ ] `cd character && npm run dev` starts without errors
- [ ] `npx tsc --noEmit` passes in both `character/` and `EmoMate/`
- [ ] Browser DevTools Console test — paste and run:

```js
// Generate a test viseme sequence manually
const visemes = [
  { shape: 'sil', time: 0, weight: 0 },
  { shape: 'aa', time: 0.05, weight: 0.85 },
  { shape: 'aa', time: 0.15, weight: 0.3 },
  { shape: 'sil', time: 0.2, weight: 0 },
  { shape: 'oh', time: 0.25, weight: 0.85 },
  { shape: 'oh', time: 0.35, weight: 0.3 },
  { shape: 'sil', time: 0.4, weight: 0 },
];
window.dispatchEvent(new MessageEvent('message', {
  data: JSON.stringify({ type: 'playVisemes', data: { visemes, totalDuration: 0.5 } })
}));
// Expected: mouth opens and closes over 0.5s
setTimeout(() => {
  window.dispatchEvent(new MessageEvent('message', {
    data: JSON.stringify({ type: 'stopVisemes' })
  }));
}, 600);
```

- [ ] Mouth closes cleanly after `stopVisemes`
- [ ] E2E: Send a message in EmoMate → character's mouth moves while audio plays
- [ ] Lip sync and facial expressions work simultaneously (e.g. joy expression + mouth moving)
- [ ] Cancelling TTS mid-sentence closes mouth (sendVRMCommand stopVisemes on cancel)
